import { createApiUrl } from "../../../shared/http";

export type XiaoAssistantStatus =
	| "idle"
	| "listening"
	| "thinking"
	| "streaming"
	| "speaking"
	| "error"
	| "offline";

export interface AIChatReference {
	title: string;
	path: string;
	published?: string;
	excerpt: string;
	score?: number;
}

export interface AIChatVoice {
	speechJa: string;
	emotion: string;
}

export interface AIChatMessage {
	id: string;
	role: "user" | "assistant";
	content: string;
	refs?: AIChatReference[];
	voice?: AIChatVoice;
	streaming?: boolean;
}

export interface AIChatSessionMeta {
	id: string;
	title: string;
	updatedAt: number;
}

export type AIChatErrorCode =
	| "validation"
	| "http"
	| "network"
	| "stream"
	| "unavailable"
	| "offline";

export interface AIChatErrorState {
	code: AIChatErrorCode;
	message: string;
	httpStatus?: number;
	recoverable: boolean;
}

export interface AIChatState {
	messages: AIChatMessage[];
	sessions: AIChatSessionMeta[];
	sessionId: string;
	status: XiaoAssistantStatus;
	isLoading: boolean;
	online: boolean;
	lastError: AIChatErrorState | null;
}

export type AIChatStreamEvent =
	| { type: "chunk"; text: string }
	| { type: "refs"; articles: AIChatReference[] }
	| ({ type: "voice" } & AIChatVoice)
	| { type: "done" }
	| { type: "error"; error: string };

export type AIChatSendOutcome =
	| "done"
	| "aborted"
	| "busy"
	| "invalid"
	| "error"
	| "offline";

export interface StorageLike {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
	removeItem(key: string): void;
}

export type AIChatAssistant = "vampire";
export type AIChatMode = "vampire";

type FetchLike = (
	input: RequestInfo | URL,
	init?: RequestInit,
) => Promise<Response>;

type Subscriber = (state: Readonly<AIChatState>) => void;

export interface AIChatControllerOptions {
	endpoint?: string;
	fetcher?: FetchLike;
	storage?: StorageLike | null;
	isOnline?: () => boolean;
	now?: () => number;
	random?: () => number;
	maxSessions?: number;
	maxHistory?: number;
	maxInputLength?: number;
	/** Optional, allow-listed chat identity sent to the API. */
	assistant?: AIChatAssistant;
	/** Optional, allow-listed server mode sent to the API. */
	mode?: AIChatMode;
	/** Prefix for persisted session keys. Defaults to the legacy `ai-chat` namespace. */
	storageNamespace?: string;
}

interface ActiveRequest {
	id: string;
	sessionId: string;
	assistantMessageId: string;
	abortController: AbortController;
	abortReason: "user" | "offline" | null;
}

const DEFAULT_STORAGE_NAMESPACE = "ai-chat";
const STORAGE_NAMESPACE_PATTERN = /^[a-z0-9][a-z0-9:-]{0,63}$/;
const DEFAULT_MAX_SESSIONS = 20;
const DEFAULT_MAX_HISTORY = 6;
const DEFAULT_MAX_INPUT_LENGTH = 1000;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function normalizeReference(value: unknown): AIChatReference | null {
	if (!isRecord(value)) return null;
	if (
		typeof value.title !== "string" ||
		typeof value.path !== "string" ||
		typeof value.excerpt !== "string"
	) {
		return null;
	}
	return {
		title: value.title,
		path: value.path,
		excerpt: value.excerpt,
		...(typeof value.published === "string"
			? { published: value.published }
			: {}),
		...(typeof value.score === "number" ? { score: value.score } : {}),
	};
}

function normalizeVoice(value: unknown): AIChatVoice | null {
	if (!isRecord(value)) return null;
	if (typeof value.speechJa !== "string" || typeof value.emotion !== "string") {
		return null;
	}
	const speechJa = value.speechJa.replace(/[\r\n\t]+/gu, " ").trim();
	const emotion = value.emotion.toLowerCase().trim();
	if (
		!speechJa ||
		speechJa.length > 120 ||
		!/[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(speechJa) ||
		!/^[a-z][a-z-]{1,31}$/.test(emotion)
	) {
		return null;
	}
	return { speechJa, emotion };
}

function normalizeStreamEvent(value: unknown): AIChatStreamEvent | null {
	if (!isRecord(value) || typeof value.type !== "string") return null;
	if (value.type === "chunk" && typeof value.text === "string") {
		return { type: "chunk", text: value.text };
	}
	if (value.type === "refs" && Array.isArray(value.articles)) {
		return {
			type: "refs",
			articles: value.articles
				.map(normalizeReference)
				.filter((item): item is AIChatReference => item !== null),
		};
	}
	if (value.type === "voice") {
		const voice = normalizeVoice(value);
		return voice ? { type: "voice", ...voice } : null;
	}
	if (value.type === "done") return { type: "done" };
	if (value.type === "error" && typeof value.error === "string") {
		return { type: "error", error: value.error };
	}
	return null;
}

/** Incrementally decodes the `data: {...}` events emitted by `/api/ai-chat/`. */
export class AIChatSSEDecoder {
	private buffer = "";

	push(chunk: string): AIChatStreamEvent[] {
		this.buffer += chunk;
		return this.drain(false);
	}

	finish(): AIChatStreamEvent[] {
		return this.drain(true);
	}

	private drain(flush: boolean): AIChatStreamEvent[] {
		const events: AIChatStreamEvent[] = [];
		while (true) {
			const boundary = /\r?\n\r?\n/.exec(this.buffer);
			if (!boundary) break;
			const block = this.buffer.slice(0, boundary.index);
			this.buffer = this.buffer.slice(boundary.index + boundary[0].length);
			const event = this.parseBlock(block);
			if (event) events.push(event);
		}

		if (flush && this.buffer.trim()) {
			const event = this.parseBlock(this.buffer);
			if (event) events.push(event);
			this.buffer = "";
		}
		return events;
	}

	private parseBlock(block: string): AIChatStreamEvent | null {
		const data = block
			.split(/\r?\n/)
			.filter((line) => line.startsWith("data:"))
			.map((line) => line.slice(5).replace(/^ /, ""))
			.join("\n");
		if (!data || data === "[DONE]") return null;
		try {
			return normalizeStreamEvent(JSON.parse(data));
		} catch {
			return null;
		}
	}
}

class AIChatRequestError extends Error {
	readonly code: AIChatErrorCode;
	readonly httpStatus?: number;

	constructor(message: string, code: AIChatErrorCode, httpStatus?: number) {
		super(message);
		this.name = "AIChatRequestError";
		this.code = code;
		this.httpStatus = httpStatus;
	}
}

export class AIChatController {
	private state: AIChatState;
	private readonly subscribers = new Set<Subscriber>();
	private readonly options: AIChatControllerOptions;
	private activeRequest: ActiveRequest | null = null;
	private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
	private restored = false;
	private unmountConnectionListeners: (() => void) | null = null;

	constructor(options: AIChatControllerOptions = {}) {
		this.options = options;
		const online = this.readOnlineState();
		this.state = {
			messages: [],
			sessions: [],
			sessionId: this.generateId("sess"),
			status: online ? "idle" : "offline",
			isLoading: false,
			online,
			lastError: online ? null : this.createOfflineError(),
		};
	}

	get snapshot(): Readonly<AIChatState> {
		return this.state;
	}

	/** Implements Svelte's readable-store contract, so components may use `$chat`. */
	subscribe = (subscriber: Subscriber): (() => void) => {
		this.subscribers.add(subscriber);
		subscriber(this.state);
		return () => this.subscribers.delete(subscriber);
	};

	/** Restore persisted sessions and observe browser online/offline changes. */
	mount(): () => void {
		this.restore();
		if (typeof window === "undefined") return () => {};

		this.unmountConnectionListeners?.();
		const handleOnline = () => this.setOnline(true);
		const handleOffline = () => this.setOnline(false);
		window.addEventListener("online", handleOnline);
		window.addEventListener("offline", handleOffline);
		this.setOnline(window.navigator.onLine);

		const unmount = () => {
			window.removeEventListener("online", handleOnline);
			window.removeEventListener("offline", handleOffline);
			if (this.unmountConnectionListeners === unmount) {
				this.unmountConnectionListeners = null;
			}
		};
		this.unmountConnectionListeners = unmount;
		return unmount;
	}

	restore(): void {
		if (this.restored) return;
		this.restored = true;
		const sessions = this.loadSessionList();
		if (sessions.length === 0) {
			this.patch({ sessions });
			return;
		}
		const latest = sessions[0];
		this.patch({
			sessions,
			sessionId: latest.id,
			messages: this.loadSessionMessages(latest.id),
		});
	}

	async send(
		question: string,
		emotionContext?: { emotion: string; valence: number } | null,
	): Promise<AIChatSendOutcome> {
		this.restore();
		const text = question.trim();
		if (!text) return "invalid";
		if (this.state.isLoading) return "busy";
		// navigator.onLine is only a hint and is frequently wrong behind VPNs,
		// captive portals and browser sandboxes. Let the request decide reachability.
		if (!this.state.online) this.setOnline(true);

		const maxInputLength =
			this.options.maxInputLength ?? DEFAULT_MAX_INPUT_LENGTH;
		if (text.length > maxInputLength) {
			const error: AIChatErrorState = {
				code: "validation",
				message: `内容过长，请控制在 ${maxInputLength} 个字符以内。`,
				recoverable: true,
			};
			this.patch({
				messages: [
					...this.state.messages,
					this.createMessage("assistant", error.message),
				],
				status: "error",
				lastError: error,
			});
			this.saveCurrentSession();
			return "invalid";
		}

		const history = this.state.messages
			.filter((message) => !message.streaming)
			.slice(-(this.options.maxHistory ?? DEFAULT_MAX_HISTORY))
			.map(({ role, content, voice }) => ({
				role,
				content,
				...(voice ? { voice } : {}),
			}));
		const userMessage = this.createMessage("user", text);
		const assistantMessage = {
			...this.createMessage("assistant", ""),
			refs: [],
			streaming: true,
		};
		const request: ActiveRequest = {
			id: this.generateId("req"),
			sessionId: this.state.sessionId,
			assistantMessageId: assistantMessage.id,
			abortController: new AbortController(),
			abortReason: null,
		};
		this.activeRequest = request;
		this.patch({
			messages: [...this.state.messages, userMessage, assistantMessage],
			status: "thinking",
			isLoading: true,
			lastError: null,
		});

		let sawDone = false;
		let streamError: AIChatErrorState | null = null;
		try {
			const response = await this.getFetcher()(
				this.options.endpoint ?? createApiUrl("api", "ai-chat"),
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						question: text,
						history,
						sessionId: request.sessionId,
						...this.getRequestProfile(),
						...(emotionContext ? { emotionContext } : {}),
					}),
					signal: request.abortController.signal,
				},
			);
			if (!response.ok) {
				const message = await this.readResponseError(response);
				throw new AIChatRequestError(
					message,
					response.status === 503 ? "unavailable" : "http",
					response.status,
				);
			}
			if (!response.body) {
				throw new AIChatRequestError("响应流不可用", "stream");
			}

			this.reader = response.body.getReader();
			const textDecoder = new TextDecoder();
			const sseDecoder = new AIChatSSEDecoder();
			while (true) {
				const next = await this.reader.read();
				if (next.done) break;
				const events = sseDecoder.push(
					textDecoder.decode(next.value, { stream: true }),
				);
				for (const event of events) {
					const result = this.applyStreamEvent(request, event);
					sawDone ||= result.done;
					streamError ??= result.error;
				}
			}
			const finalEvents = sseDecoder.push(textDecoder.decode());
			finalEvents.push(...sseDecoder.finish());
			for (const event of finalEvents) {
				const result = this.applyStreamEvent(request, event);
				sawDone ||= result.done;
				streamError ??= result.error;
			}

			if (!this.isActive(request)) return "aborted";
			if (streamError) return "error";
			if (!sawDone) {
				throw new AIChatRequestError("响应流在完成前中断", "stream");
			}
			this.patch({ status: "idle", lastError: null });
			return "done";
		} catch (value) {
			if (!this.isActive(request)) return "aborted";
			const error = value instanceof Error ? value : new Error(String(value));
			if (error.name === "AbortError" || request.abortReason) {
				if (request.abortReason === "offline") {
					this.appendAssistantNote(request, "> 连接已离线，生成已暂停。");
					this.patch({
						status: "offline",
						online: false,
						lastError: this.createOfflineError(),
					});
					return "offline";
				}
				this.appendAssistantNote(request, "> *（已停止生成）*");
				this.patch({ status: "idle", lastError: null });
				return "aborted";
			}

			const normalized = this.normalizeRequestError(error);
			this.replaceAssistantContent(
				request,
				this.getUserFacingErrorMessage(normalized),
			);
			this.patch({
				status: normalized.code === "offline" ? "offline" : "error",
				online: normalized.code === "offline" ? false : this.state.online,
				lastError: normalized,
			});
			return normalized.code === "offline" ? "offline" : "error";
		} finally {
			if (this.isActive(request)) {
				this.markAssistantComplete(request);
				this.patch({ isLoading: false });
				this.activeRequest = null;
				this.reader = null;
				this.saveCurrentSession();
			}
		}
	}

	stop(): void {
		if (!this.activeRequest) return;
		this.activeRequest.abortReason = "user";
		this.activeRequest.abortController.abort();
		void this.reader?.cancel().catch(() => {});
	}

	startNewSession(): void {
		this.saveCurrentSession();
		this.invalidateActiveRequest();
		this.patch({
			sessionId: this.generateId("sess"),
			messages: [],
			isLoading: false,
			status: this.state.online ? "idle" : "offline",
			lastError: this.state.online ? null : this.createOfflineError(),
		});
	}

	switchSession(id: string): boolean {
		if (id === this.state.sessionId) return true;
		if (!this.state.sessions.some((session) => session.id === id)) return false;
		this.saveCurrentSession();
		this.invalidateActiveRequest();
		this.patch({
			sessionId: id,
			messages: this.loadSessionMessages(id),
			isLoading: false,
			status: this.state.online ? "idle" : "offline",
			lastError: this.state.online ? null : this.createOfflineError(),
		});
		return true;
	}

	deleteSession(id: string): void {
		this.removeStorageItem(this.getSessionStorageKey(id));
		const sessions = this.state.sessions.filter((session) => session.id !== id);
		this.writeStorageItem(
			this.getSessionsStorageKey(),
			JSON.stringify(sessions),
		);
		if (id !== this.state.sessionId) {
			this.patch({ sessions });
			return;
		}
		this.invalidateActiveRequest();
		const latest = sessions[0];
		this.patch({
			sessions,
			sessionId: latest?.id ?? this.generateId("sess"),
			messages: latest ? this.loadSessionMessages(latest.id) : [],
			isLoading: false,
			status: this.state.online ? "idle" : "offline",
			lastError: this.state.online ? null : this.createOfflineError(),
		});
	}

	setListening(active: boolean): void {
		if (!this.state.online || this.state.isLoading) return;
		if (active) {
			this.patch({ status: "listening", lastError: null });
		} else if (this.state.status === "listening") {
			this.patch({ status: "idle" });
		}
	}

	setSpeaking(active: boolean): void {
		if (!this.state.online || this.state.isLoading) return;
		if (active) {
			this.patch({ status: "speaking", lastError: null });
		} else if (this.state.status === "speaking") {
			this.patch({ status: "idle" });
		}
	}

	setOnline(online: boolean): void {
		if (!online && this.activeRequest) {
			this.activeRequest.abortReason = "offline";
			this.activeRequest.abortController.abort();
			void this.reader?.cancel().catch(() => {});
		}
		if (!online) {
			this.patch({
				online: false,
				status: "offline",
				lastError: this.createOfflineError(),
			});
			return;
		}
		this.patch({
			online: true,
			status: this.state.status === "offline" ? "idle" : this.state.status,
			lastError:
				this.state.lastError?.code === "offline" ? null : this.state.lastError,
		});
	}

	clearError(): void {
		if (this.state.status !== "error") return;
		this.patch({
			status: this.state.online ? "idle" : "offline",
			lastError: null,
		});
	}

	destroy(): void {
		this.saveCurrentSession();
		this.invalidateActiveRequest();
		this.unmountConnectionListeners?.();
		this.unmountConnectionListeners = null;
	}

	private applyStreamEvent(
		request: ActiveRequest,
		event: AIChatStreamEvent,
	): { done: boolean; error: AIChatErrorState | null } {
		if (!this.isActive(request)) return { done: false, error: null };
		if (event.type === "chunk") {
			this.updateAssistant(request, (message) => ({
				...message,
				content: message.content + event.text,
			}));
			this.patch({ status: "streaming" });
			return { done: false, error: null };
		}
		if (event.type === "refs") {
			this.updateAssistant(request, (message) => ({
				...message,
				refs: event.articles,
			}));
			return { done: false, error: null };
		}
		if (event.type === "voice") {
			this.updateAssistant(request, (message) => ({
				...message,
				voice: { speechJa: event.speechJa, emotion: event.emotion },
			}));
			return { done: false, error: null };
		}
		if (event.type === "error") {
			const error: AIChatErrorState = {
				code: "stream",
				message: event.error,
				recoverable: true,
			};
			this.appendAssistantNote(request, `> 错误：${event.error}`);
			this.patch({ status: "error", lastError: error });
			return { done: false, error };
		}
		return { done: true, error: null };
	}

	private updateAssistant(
		request: ActiveRequest,
		update: (message: AIChatMessage) => AIChatMessage,
	): void {
		if (!this.isActive(request)) return;
		const index = this.state.messages.findIndex(
			(message) => message.id === request.assistantMessageId,
		);
		if (index < 0) return;
		const messages = [...this.state.messages];
		messages[index] = update(messages[index]);
		this.patch({ messages });
	}

	private appendAssistantNote(request: ActiveRequest, note: string): void {
		this.updateAssistant(request, (message) => ({
			...message,
			content: message.content ? `${message.content}\n\n${note}` : note,
		}));
	}

	private replaceAssistantContent(
		request: ActiveRequest,
		content: string,
	): void {
		this.updateAssistant(request, (message) => ({ ...message, content }));
	}

	private markAssistantComplete(request: ActiveRequest): void {
		this.updateAssistant(request, (message) => ({
			...message,
			streaming: false,
		}));
	}

	private isActive(request: ActiveRequest): boolean {
		return (
			this.activeRequest?.id === request.id &&
			this.state.sessionId === request.sessionId
		);
	}

	private invalidateActiveRequest(): void {
		const active = this.activeRequest;
		this.activeRequest = null;
		if (!active) return;
		active.abortController.abort();
		void this.reader?.cancel().catch(() => {});
		this.reader = null;
	}

	private saveCurrentSession(): void {
		if (!this.state.sessionId || this.state.messages.length === 0) return;
		if (this.state.messages.some((message) => message.streaming)) return;

		const updatedAt = this.now();
		const current: AIChatSessionMeta = {
			id: this.state.sessionId,
			title: this.getSessionTitle(this.state.messages),
			updatedAt,
		};
		const maxSessions = this.options.maxSessions ?? DEFAULT_MAX_SESSIONS;
		const sessions = [
			current,
			...this.state.sessions.filter(
				(session) => session.id !== this.state.sessionId,
			),
		].slice(0, maxSessions);
		const removed = this.state.sessions.filter(
			(session) => !sessions.some((kept) => kept.id === session.id),
		);

		this.writeStorageItem(
			this.getSessionStorageKey(this.state.sessionId),
			JSON.stringify(this.state.messages),
		);
		this.writeStorageItem(
			this.getSessionsStorageKey(),
			JSON.stringify(sessions),
		);
		for (const session of removed) {
			this.removeStorageItem(this.getSessionStorageKey(session.id));
		}
		this.patch({ sessions });
	}

	private loadSessionList(): AIChatSessionMeta[] {
		const raw = this.readStorageItem(this.getSessionsStorageKey());
		if (!raw) return [];
		try {
			const value: unknown = JSON.parse(raw);
			if (!Array.isArray(value)) return [];
			return value
				.filter(
					(item): item is AIChatSessionMeta =>
						isRecord(item) &&
						typeof item.id === "string" &&
						typeof item.title === "string" &&
						typeof item.updatedAt === "number",
				)
				.sort((left, right) => right.updatedAt - left.updatedAt)
				.slice(0, this.options.maxSessions ?? DEFAULT_MAX_SESSIONS);
		} catch {
			return [];
		}
	}

	private loadSessionMessages(id: string): AIChatMessage[] {
		const raw = this.readStorageItem(this.getSessionStorageKey(id));
		if (!raw) return [];
		try {
			const value: unknown = JSON.parse(raw);
			if (!Array.isArray(value)) return [];
			return value.flatMap((item) => {
				if (
					!isRecord(item) ||
					(item.role !== "user" && item.role !== "assistant") ||
					typeof item.content !== "string"
				) {
					return [];
				}
				const refs = Array.isArray(item.refs)
					? item.refs
							.map(normalizeReference)
							.filter((ref): ref is AIChatReference => ref !== null)
					: undefined;
				const voice = normalizeVoice(item.voice);
				return [
					{
						id: typeof item.id === "string" ? item.id : this.generateId("msg"),
						role: item.role,
						content: item.content,
						...(refs ? { refs } : {}),
						...(voice ? { voice } : {}),
						streaming: false,
					},
				];
			});
		} catch {
			return [];
		}
	}

	private getSessionTitle(messages: AIChatMessage[]): string {
		const firstUser = messages.find((message) => message.role === "user");
		if (!firstUser) return "新对话";
		return firstUser.content.length > 20
			? `${firstUser.content.slice(0, 20)}...`
			: firstUser.content;
	}

	private createMessage(
		role: AIChatMessage["role"],
		content: string,
	): AIChatMessage {
		return { id: this.generateId("msg"), role, content };
	}

	private generateId(prefix: string): string {
		return `${prefix}_${this.now()}_${this.random().toString(36).slice(2, 8)}`;
	}

	private now(): number {
		return (this.options.now ?? Date.now)();
	}

	private random(): number {
		return (this.options.random ?? Math.random)();
	}

	private getRequestProfile(): Partial<{
		assistant: AIChatAssistant;
		mode: AIChatMode;
	}> {
		return {
			...(this.options.assistant === "vampire"
				? { assistant: this.options.assistant }
				: {}),
			...(this.options.mode === "vampire" ? { mode: this.options.mode } : {}),
		};
	}

	private getStorageNamespace(): string {
		const namespace = this.options.storageNamespace;
		return namespace && STORAGE_NAMESPACE_PATTERN.test(namespace)
			? namespace
			: DEFAULT_STORAGE_NAMESPACE;
	}

	private getSessionsStorageKey(): string {
		return `${this.getStorageNamespace()}:sessions`;
	}

	private getSessionStorageKey(id: string): string {
		return `${this.getStorageNamespace()}:session:${id}`;
	}

	private getAssistantDisplayName(): string {
		return this.options.assistant === "vampire" ? "夜访" : "小爱助手";
	}

	private getStorage(): StorageLike | null {
		if (this.options.storage !== undefined) return this.options.storage;
		try {
			return typeof localStorage === "undefined" ? null : localStorage;
		} catch {
			return null;
		}
	}

	private readStorageItem(key: string): string | null {
		try {
			return this.getStorage()?.getItem(key) ?? null;
		} catch {
			return null;
		}
	}

	private writeStorageItem(key: string, value: string): void {
		try {
			this.getStorage()?.setItem(key, value);
		} catch {
			// The in-memory session remains usable when storage is unavailable.
		}
	}

	private removeStorageItem(key: string): void {
		try {
			this.getStorage()?.removeItem(key);
		} catch {
			// Ignore storage failures in private browsing modes.
		}
	}

	private readOnlineState(): boolean {
		try {
			if (this.options.isOnline) return this.options.isOnline();
			return typeof navigator === "undefined" ? true : navigator.onLine;
		} catch {
			return true;
		}
	}

	private getFetcher(): FetchLike {
		if (this.options.fetcher) return this.options.fetcher;
		if (typeof fetch === "function") return fetch.bind(globalThis);
		throw new AIChatRequestError("当前环境不支持网络请求", "network");
	}

	private async readResponseError(response: Response): Promise<string> {
		try {
			const value: unknown = await response.json();
			if (isRecord(value) && typeof value.error === "string")
				return value.error;
		} catch {
			// Fall through to the stable status message.
		}
		return `请求失败 (${response.status})`;
	}

	private normalizeRequestError(error: Error): AIChatErrorState {
		if (error instanceof AIChatRequestError) {
			return {
				code: error.code,
				message: error.message,
				...(error.httpStatus ? { httpStatus: error.httpStatus } : {}),
				recoverable: true,
			};
		}
		const looksOffline =
			!this.readOnlineState() ||
			error instanceof TypeError ||
			/failed to fetch|network|load failed/i.test(error.message);
		if (looksOffline) return this.createOfflineError(error.message);
		return {
			code: "network",
			message: error.message,
			recoverable: true,
		};
	}

	private createOfflineError(message = "网络连接不可用"): AIChatErrorState {
		return { code: "offline", message, recoverable: true };
	}

	private getUserFacingErrorMessage(error: AIChatErrorState): string {
		if (error.code === "offline") {
			return `当前处于离线状态。网络恢复后可以继续和${this.getAssistantDisplayName()}对话。`;
		}
		if (
			error.httpStatus === 429 ||
			/quota|insufficient_quota/i.test(error.message)
		) {
			return "今天的对话额度已经用完了。稍后再来，我会从这里继续等你。";
		}
		if (error.code === "unavailable") {
			return `${this.getAssistantDisplayName()}尚未配置或暂时不可用，请稍后再试。`;
		}
		return "连接暂时中断了，请稍后再试。";
	}

	private patch(patch: Partial<AIChatState>): void {
		this.state = { ...this.state, ...patch };
		for (const subscriber of this.subscribers) subscriber(this.state);
	}
}

export function createAIChatController(
	options: AIChatControllerOptions = {},
): AIChatController {
	return new AIChatController(options);
}
