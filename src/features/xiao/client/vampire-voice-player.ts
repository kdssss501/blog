import { createApiUrl } from "@/shared/http";

export type VampireVoicePhase =
	| "idle"
	| "queued"
	| "generating"
	| "buffering"
	| "playing"
	| "complete"
	| "error";

export interface VampireVoiceRequest {
	messageId: string;
	speechJa: string;
	emotion: string;
}

export interface VampireVoiceState extends VampireVoiceRequest {
	phase: VampireVoicePhase;
	progress: number;
	error: string | null;
}

interface VampireVoicePlayerOptions {
	endpoint?: string;
	fetcher?: typeof fetch;
	onState?: (state: Readonly<VampireVoiceState>) => void;
	onVoiceLevel?: (level: number, peak: number) => void;
	onPlayingChange?: (playing: boolean) => void;
}

interface CachedVoice {
	speechJa: string;
	url: string;
}

type WebkitAudioWindow = Window &
	typeof globalThis & {
		webkitAudioContext?: typeof AudioContext;
	};

const EMPTY_REQUEST: VampireVoiceRequest = {
	messageId: "",
	speechJa: "",
	emotion: "neutral",
};

const clamp = (value: number, min = 0, max = 100) =>
	Math.min(max, Math.max(min, value));

export const normalizeVoiceRms = (rms: number) => {
	if (!Number.isFinite(rms)) return 0;
	const gated = clamp((rms - 0.006) * 18, 0, 1);
	return gated ** 0.78;
};

export class VampireVoicePlayer {
	private readonly options: VampireVoicePlayerOptions;
	private readonly audio = new Audio();
	private readonly cache = new Map<string, CachedVoice>();
	private state: VampireVoiceState = {
		...EMPTY_REQUEST,
		phase: "idle",
		progress: 0,
		error: null,
	};
	private context: AudioContext | null = null;
	private analyser: AnalyserNode | null = null;
	private timeDomain: Uint8Array<ArrayBuffer> | null = null;
	private abortController: AbortController | null = null;
	private progressTimer = 0;
	private analysisFrame = 0;
	private sequence = 0;
	private peak = 0;
	private destroyed = false;

	constructor(options: VampireVoicePlayerOptions = {}) {
		this.options = options;
		this.audio.preload = "auto";
		this.audio.addEventListener("ended", this.handleEnded);
		this.audio.addEventListener("error", this.handleAudioError);
	}

	get snapshot(): Readonly<VampireVoiceState> {
		return this.state;
	}

	/** Call synchronously from a user gesture so delayed TTS playback is allowed. */
	unlock(): void {
		void this.ensureAudioGraph()
			.then(() => this.context?.resume())
			.catch(() => {});
	}

	async play(request: VampireVoiceRequest): Promise<void> {
		if (this.destroyed) return;
		const sequence = ++this.sequence;
		this.cancelActive(false);
		this.state = {
			...request,
			phase: "queued",
			progress: 4,
			error: null,
		};
		this.publish();

		const cached = this.cache.get(request.messageId);
		if (cached?.speechJa === request.speechJa) {
			await this.startPlayback(cached.url, sequence);
			return;
		}

		this.abortController = new AbortController();
		const startedAt = performance.now();
		this.patch({ phase: "generating", progress: 10 });
		this.progressTimer = window.setInterval(() => {
			const elapsed = performance.now() - startedAt;
			const inferred = 10 + (1 - Math.exp(-elapsed / 12_000)) * 64;
			this.patch({ progress: Math.max(this.state.progress, inferred) });
		}, 240);

		try {
			const fetcher = this.options.fetcher ?? fetch.bind(globalThis);
			const response = await fetcher(
				this.options.endpoint ?? createApiUrl("api", "xiao", "tts"),
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						text: request.speechJa,
						emotion: request.emotion,
					}),
					signal: this.abortController.signal,
				},
			);
			if (sequence !== this.sequence) return;
			if (!response.ok) throw new Error(await this.readResponseError(response));

			this.clearProgressTimer();
			this.patch({ phase: "buffering", progress: 76 });
			const blob = await this.readAudioBlob(response, sequence);
			if (sequence !== this.sequence) return;
			const url = URL.createObjectURL(blob);
			this.remember(request.messageId, request.speechJa, url);
			await this.startPlayback(url, sequence);
		} catch (value) {
			if (sequence !== this.sequence) return;
			const error = value instanceof Error ? value : new Error(String(value));
			if (error.name === "AbortError") return;
			this.options.onPlayingChange?.(false);
			this.options.onVoiceLevel?.(0, 0);
			this.patch({
				phase: "error",
				progress: 0,
				error: error.message || "TTS request failed",
			});
		} finally {
			if (sequence === this.sequence) this.abortController = null;
			this.clearProgressTimer();
		}
	}

	stop(): void {
		this.sequence += 1;
		this.cancelActive(true);
	}

	destroy(): void {
		if (this.destroyed) return;
		this.destroyed = true;
		this.stop();
		this.audio.removeEventListener("ended", this.handleEnded);
		this.audio.removeEventListener("error", this.handleAudioError);
		for (const cached of this.cache.values()) URL.revokeObjectURL(cached.url);
		this.cache.clear();
		void this.context?.close().catch(() => {});
		this.context = null;
		this.analyser = null;
		this.timeDomain = null;
	}

	private async ensureAudioGraph(): Promise<void> {
		if (this.context) return;
		const AudioContextClass =
			window.AudioContext ?? (window as WebkitAudioWindow).webkitAudioContext;
		if (!AudioContextClass) return;
		const context = new AudioContextClass();
		const analyser = context.createAnalyser();
		analyser.fftSize = 512;
		analyser.smoothingTimeConstant = 0.58;
		const source = context.createMediaElementSource(this.audio);
		source.connect(analyser);
		analyser.connect(context.destination);
		this.context = context;
		this.analyser = analyser;
		this.timeDomain = new Uint8Array(new ArrayBuffer(analyser.fftSize));
	}

	private async startPlayback(url: string, sequence: number): Promise<void> {
		if (sequence !== this.sequence) return;
		await this.ensureAudioGraph();
		if (this.context?.state === "suspended") await this.context.resume();
		this.audio.src = url;
		this.audio.currentTime = 0;
		await this.audio.play();
		if (sequence !== this.sequence) {
			this.audio.pause();
			return;
		}
		this.patch({ phase: "playing", progress: 93, error: null });
		this.options.onPlayingChange?.(true);
		this.startAnalysisLoop(sequence);
	}

	private startAnalysisLoop(sequence: number): void {
		if (this.analysisFrame) window.cancelAnimationFrame(this.analysisFrame);
		let lastProgressUpdate = 0;
		const analyze = (timestamp: number) => {
			if (sequence !== this.sequence || this.audio.paused || this.audio.ended) {
				this.analysisFrame = 0;
				return;
			}

			let level = 0;
			if (this.analyser && this.timeDomain) {
				this.analyser.getByteTimeDomainData(this.timeDomain);
				let energy = 0;
				for (const sample of this.timeDomain) {
					const centered = (sample - 128) / 128;
					energy += centered * centered;
				}
				const rms = Math.sqrt(energy / this.timeDomain.length);
				level = normalizeVoiceRms(rms);
			}
			this.peak = Math.max(level, this.peak * 0.84);
			this.options.onVoiceLevel?.(level, this.peak);

			if (timestamp - lastProgressUpdate >= 120) {
				lastProgressUpdate = timestamp;
				const duration = this.audio.duration;
				const ratio =
					Number.isFinite(duration) && duration > 0
						? this.audio.currentTime / duration
						: 0;
				this.patch({ progress: 93 + clamp(ratio, 0, 1) * 7 });
			}
			this.analysisFrame = window.requestAnimationFrame(analyze);
		};
		this.analysisFrame = window.requestAnimationFrame(analyze);
	}

	private async readAudioBlob(
		response: Response,
		sequence: number,
	): Promise<Blob> {
		if (!response.body) return response.blob();
		const total = Number(response.headers.get("Content-Length")) || 0;
		const reader = response.body.getReader();
		const chunks: Uint8Array<ArrayBuffer>[] = [];
		let received = 0;
		while (true) {
			const next = await reader.read();
			if (next.done) break;
			if (sequence !== this.sequence) {
				await reader.cancel();
				throw new DOMException("Superseded", "AbortError");
			}
			const chunk = new Uint8Array(next.value);
			chunks.push(chunk);
			received += chunk.byteLength;
			const ratio =
				total > 0 ? received / total : 1 - Math.exp(-received / 180_000);
			this.patch({ progress: 76 + clamp(ratio, 0, 1) * 16 });
		}
		return new Blob(chunks, {
			type: response.headers.get("Content-Type") || "audio/wav",
		});
	}

	private remember(messageId: string, speechJa: string, url: string): void {
		const previous = this.cache.get(messageId);
		if (previous) URL.revokeObjectURL(previous.url);
		this.cache.delete(messageId);
		this.cache.set(messageId, { speechJa, url });
		while (this.cache.size > 4) {
			const oldestKey = this.cache.keys().next().value as string | undefined;
			if (!oldestKey) break;
			const oldest = this.cache.get(oldestKey);
			if (oldest) URL.revokeObjectURL(oldest.url);
			this.cache.delete(oldestKey);
		}
	}

	private cancelActive(resetState: boolean): void {
		this.abortController?.abort();
		this.abortController = null;
		this.clearProgressTimer();
		if (this.analysisFrame) window.cancelAnimationFrame(this.analysisFrame);
		this.analysisFrame = 0;
		this.audio.pause();
		this.audio.removeAttribute("src");
		this.audio.load();
		this.peak = 0;
		this.options.onVoiceLevel?.(0, 0);
		this.options.onPlayingChange?.(false);
		if (resetState) {
			this.state = {
				...EMPTY_REQUEST,
				phase: "idle",
				progress: 0,
				error: null,
			};
			this.publish();
		}
	}

	private clearProgressTimer(): void {
		if (!this.progressTimer) return;
		window.clearInterval(this.progressTimer);
		this.progressTimer = 0;
	}

	private handleEnded = () => {
		if (this.analysisFrame) window.cancelAnimationFrame(this.analysisFrame);
		this.analysisFrame = 0;
		this.peak = 0;
		this.options.onVoiceLevel?.(0, 0);
		this.options.onPlayingChange?.(false);
		this.patch({ phase: "complete", progress: 100, error: null });
	};

	private handleAudioError = () => {
		if (!this.audio.src || this.state.phase !== "playing") return;
		this.options.onPlayingChange?.(false);
		this.options.onVoiceLevel?.(0, 0);
		this.patch({ phase: "error", progress: 0, error: "Audio playback failed" });
	};

	private patch(patch: Partial<VampireVoiceState>): void {
		this.state = {
			...this.state,
			...patch,
			progress: clamp(patch.progress ?? this.state.progress),
		};
		this.publish();
	}

	private publish(): void {
		this.options.onState?.({ ...this.state });
	}

	private async readResponseError(response: Response): Promise<string> {
		try {
			const payload: unknown = await response.json();
			if (
				typeof payload === "object" &&
				payload !== null &&
				"error" in payload &&
				typeof payload.error === "string"
			) {
				return payload.error;
			}
		} catch {
			// Keep the stable HTTP fallback below.
		}
		return `TTS request failed (${response.status})`;
	}
}

export const createVampireVoicePlayer = (options?: VampireVoicePlayerOptions) =>
	new VampireVoicePlayer(options);
