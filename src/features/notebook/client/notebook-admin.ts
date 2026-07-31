import { renderRichContent } from "@/features/activity";
import {
	deleteAdminNotebookEntry,
	fetchAdminNotebookEntries,
	NotebookAdminApiError,
	saveAdminNotebookEntry,
	verifyNotebookAdminToken,
} from "../data/notebook-admin-api";
import { GALLERY_IMAGES, getCoverImage } from "../model/notebook-covers";
import { sortNotebookEntries } from "../model/notebook-groups";
import type { NotebookEntry } from "../model/types";

const TOKEN_STORAGE_KEY = "notebook_admin_token";

class NotebookAdminElement extends HTMLElement {
	private eventController: AbortController | undefined;
	private token = "";
	private currentEntry: NotebookEntry | undefined;
	private currentCover = "";
	private entries: NotebookEntry[] = [];
	private notebookFilter = "";

	connectedCallback() {
		this.eventController?.abort();
		this.eventController = new AbortController();
		const signal = this.eventController.signal;
		this.on("[data-notebook-admin-login]", "click", this.handleLogin, signal);
		this.on(
			"[data-notebook-admin-token]",
			"keydown",
			this.handleTokenKeydown,
			signal,
		);
		this.on(
			"[data-notebook-admin-new-entry]",
			"click",
			() => this.newEntry(),
			signal,
		);
		this.on(
			"[data-notebook-admin-new-book]",
			"click",
			this.handleNewNotebook,
			signal,
		);
		this.on("[data-notebook-admin-save]", "click", this.handleSave, signal);
		this.on("[data-notebook-admin-delete]", "click", this.handleDelete, signal);
		this.on(
			"[data-notebook-admin-cancel]",
			"click",
			() => this.newEntry(),
			signal,
		);
		this.on(
			"[data-notebook-admin-clear-cover]",
			"click",
			this.handleClearCover,
			signal,
		);
		this.on(
			"[data-notebook-admin-file]",
			"change",
			this.handleFileChange,
			signal,
		);
		this.on(
			"[data-notebook-admin-content]",
			"input",
			() => this.updatePreview(),
			signal,
		);

		this.renderCoverGallery();
		this.newEntry();
		this.token = readToken();
		if (this.token) void this.authenticate(this.token);
		else this.showLogin();
	}

	disconnectedCallback() {
		this.eventController?.abort();
	}

	private on(
		selector: string,
		type: string,
		listener: EventListener,
		signal: AbortSignal,
	) {
		this.querySelector(selector)?.addEventListener(type, listener, { signal });
	}

	private readonly handleTokenKeydown: EventListener = (event) => {
		if ((event as KeyboardEvent).key === "Enter") this.handleLogin();
	};

	private readonly handleLogin = () => {
		const token = this.input("[data-notebook-admin-token]").value.trim();
		if (!token) {
			this.setLoginError("请输入管理 Token。");
			return;
		}
		void this.authenticate(token);
	};

	private async authenticate(token: string) {
		this.setLoginBusy(true);
		this.setLoginError("");
		try {
			await verifyNotebookAdminToken(token);
			this.token = token;
			writeToken(token);
			this.required<HTMLElement>("[data-notebook-admin-login-panel]").hidden =
				true;
			this.required<HTMLElement>("[data-notebook-admin-panel]").hidden = false;
			await this.loadEntries();
		} catch (error) {
			this.clearTokenIfUnauthorized(error);
			this.showLogin();
			this.setLoginError(adminErrorMessage(error));
		} finally {
			this.setLoginBusy(false);
		}
	}

	private showLogin() {
		const login = this.querySelector<HTMLElement>(
			"[data-notebook-admin-login-panel]",
		);
		const panel = this.querySelector<HTMLElement>(
			"[data-notebook-admin-panel]",
		);
		if (login) login.hidden = false;
		if (panel) panel.hidden = true;
	}

	private async loadEntries() {
		this.entries = sortNotebookEntries(
			await fetchAdminNotebookEntries(this.token),
		);
		this.renderNotebookSelector();
		this.renderEntryList();
	}

	private renderNotebookSelector() {
		const container = this.querySelector<HTMLElement>(
			"[data-notebook-admin-selector]",
		);
		if (!container) return;
		const counts = new Map<string, number>();
		for (const entry of this.entries) {
			counts.set(entry.notebook, (counts.get(entry.notebook) ?? 0) + 1);
		}
		const options = [["", this.entries.length] as const, ...counts.entries()];
		container.replaceChildren(
			...options.map(([name, count]) => {
				const button = document.createElement("button");
				button.type = "button";
				button.className = "notebook-admin-filter";
				button.classList.toggle("is-active", this.notebookFilter === name);
				button.setAttribute(
					"aria-pressed",
					String(this.notebookFilter === name),
				);
				button.append(
					createText("span", "", name || "全部"),
					createText("small", "", String(count)),
				);
				button.addEventListener(
					"click",
					() => {
						this.notebookFilter = name;
						if (name) this.input("[data-notebook-admin-notebook]").value = name;
						this.renderNotebookSelector();
						this.renderEntryList();
					},
					{ signal: this.eventController?.signal },
				);
				return button;
			}),
		);
	}

	private renderEntryList() {
		const list = this.querySelector<HTMLElement>("[data-notebook-admin-list]");
		if (!list) return;
		const entries = this.notebookFilter
			? this.entries.filter((entry) => entry.notebook === this.notebookFilter)
			: this.entries;
		if (entries.length === 0) {
			list.replaceChildren(
				createText("p", "notebook-admin-muted", "暂无笔记。"),
			);
			return;
		}
		list.replaceChildren(
			...entries.map((entry) => {
				const button = document.createElement("button");
				button.type = "button";
				button.className = "notebook-admin-entry";
				button.append(
					createText("strong", "", entry.title),
					createText("span", "", `${entry.notebook} · ${entry.date}`),
					createText("small", "", entry.content.slice(0, 90)),
				);
				button.addEventListener("click", () => this.editEntry(entry), {
					signal: this.eventController?.signal,
				});
				return button;
			}),
		);
	}

	private editEntry(entry: NotebookEntry) {
		this.currentEntry = entry;
		this.currentCover = entry.cover || "";
		this.input("[data-notebook-admin-title]").value = entry.title;
		this.input("[data-notebook-admin-date]").value = entry.date;
		this.input("[data-notebook-admin-notebook]").value = entry.notebook;
		this.textarea("[data-notebook-admin-content]").value = entry.content;
		this.button("[data-notebook-admin-delete]").hidden = false;
		this.updateCoverPreview();
		this.updatePreview();
		this.querySelector("[data-notebook-admin-editor]")?.scrollIntoView({
			behavior: "smooth",
			block: "start",
		});
	}

	private newEntry(notebook = "") {
		this.currentEntry = undefined;
		this.currentCover = "";
		this.input("[data-notebook-admin-title]").value = "";
		this.input("[data-notebook-admin-date]").value = new Date()
			.toISOString()
			.slice(0, 10);
		this.input("[data-notebook-admin-notebook]").value =
			notebook || this.notebookFilter;
		this.textarea("[data-notebook-admin-content]").value = "";
		this.button("[data-notebook-admin-delete]").hidden = true;
		const file = this.input("[data-notebook-admin-file]");
		file.value = "";
		this.updateCoverPreview();
		this.updatePreview();
		this.setMessage("", "");
	}

	private readonly handleNewNotebook = () => {
		this.notebookFilter = "";
		this.newEntry();
		this.input("[data-notebook-admin-notebook]").focus();
	};

	private readonly handleClearCover = () => {
		this.currentCover = "";
		this.input("[data-notebook-admin-file]").value = "";
		this.updateCoverPreview();
	};

	private renderCoverGallery() {
		const gallery = this.querySelector<HTMLElement>(
			"[data-notebook-admin-gallery]",
		);
		if (!gallery) return;
		gallery.replaceChildren(
			...GALLERY_IMAGES.map((image, index) => {
				const button = document.createElement("button");
				button.type = "button";
				button.className = "notebook-admin-cover-option";
				button.dataset.cover = `default-${index + 1}`;
				button.style.backgroundImage = `url("/gallery/gpt-img2-2026/${image}")`;
				button.setAttribute("aria-label", `选择封面 ${index + 1}`);
				button.addEventListener(
					"click",
					() => {
						this.currentCover = `default-${index + 1}`;
						this.updateCoverPreview();
					},
					{ signal: this.eventController?.signal },
				);
				return button;
			}),
		);
	}

	private updateCoverPreview() {
		const preview = this.querySelector<HTMLElement>(
			"[data-notebook-admin-cover-preview]",
		);
		if (!preview) return;
		preview.style.backgroundImage = this.currentCover
			? `url("${getCoverImage(this.currentCover, this.input("[data-notebook-admin-notebook]").value || "notebook")}")`
			: "";
		preview.dataset.empty = String(!this.currentCover);
		this.querySelectorAll<HTMLElement>("[data-cover]").forEach((button) => {
			button.classList.toggle(
				"is-selected",
				button.dataset.cover === this.currentCover,
			);
		});
	}

	private readonly handleFileChange: EventListener = async (event) => {
		const file = (event.target as HTMLInputElement).files?.[0];
		if (!file) return;
		if (!file.type.startsWith("image/")) {
			this.setMessage("请选择图片文件。", "error");
			return;
		}
		try {
			this.currentCover = await compressImage(file, 800);
			this.updateCoverPreview();
			if (this.currentCover.length > 700_000) {
				this.setMessage("封面体积较大，建议压缩后重新上传。", "error");
			}
		} catch {
			this.setMessage("封面处理失败。", "error");
		}
	};

	private updatePreview() {
		const preview = this.querySelector<HTMLElement>(
			"[data-notebook-admin-preview]",
		);
		if (!preview) return;
		const content = this.textarea("[data-notebook-admin-content]").value;
		preview.innerHTML = content
			? renderRichContent(content)
			: '<p class="notebook-admin-muted">预览区域</p>';
	}

	private readonly handleSave = async () => {
		const input = {
			title: this.input("[data-notebook-admin-title]").value.trim(),
			date: this.input("[data-notebook-admin-date]").value,
			notebook: this.input("[data-notebook-admin-notebook]").value.trim(),
			content: this.textarea("[data-notebook-admin-content]").value.trim(),
			cover: this.currentCover,
		};
		if (!input.title || !input.date || !input.notebook || !input.content) {
			this.setMessage("请填写所有必填字段。", "error");
			return;
		}
		const button = this.button("[data-notebook-admin-save]");
		button.disabled = true;
		try {
			await saveAdminNotebookEntry(this.token, input, this.currentEntry?.id);
			await this.loadEntries();
			this.newEntry(input.notebook);
			this.setMessage("笔记已保存。", "success");
		} catch (error) {
			this.handleAdminError(error, "保存失败");
		} finally {
			button.disabled = false;
		}
	};

	private readonly handleDelete = async () => {
		if (!this.currentEntry) return;
		if (!window.confirm("确定删除这条笔记吗？")) return;
		try {
			await deleteAdminNotebookEntry(this.token, this.currentEntry.id);
			await this.loadEntries();
			this.newEntry();
			this.setMessage("笔记已删除。", "success");
		} catch (error) {
			this.handleAdminError(error, "删除失败");
		}
	};

	private handleAdminError(error: unknown, fallback: string) {
		this.clearTokenIfUnauthorized(error);
		if (
			error instanceof NotebookAdminApiError &&
			(error.status === 401 || error.status === 503)
		) {
			this.showLogin();
			this.setLoginError(adminErrorMessage(error));
			return;
		}
		this.setMessage(error instanceof Error ? error.message : fallback, "error");
	}

	private clearTokenIfUnauthorized(error: unknown) {
		if (
			error instanceof NotebookAdminApiError &&
			(error.status === 401 || error.status === 503)
		) {
			this.token = "";
			removeToken();
		}
	}

	private setMessage(message: string, state: "" | "success" | "error") {
		const target = this.querySelector<HTMLElement>(
			"[data-notebook-admin-message]",
		);
		if (!target) return;
		target.textContent = message;
		target.dataset.state = state;
	}

	private setLoginError(message: string) {
		const target = this.querySelector<HTMLElement>(
			"[data-notebook-admin-login-error]",
		);
		if (target) target.textContent = message;
	}

	private setLoginBusy(busy: boolean) {
		const button = this.button("[data-notebook-admin-login]");
		button.disabled = busy;
		button.textContent = busy ? "验证中..." : "登录";
	}

	private input(selector: string) {
		return this.required<HTMLInputElement>(selector);
	}

	private textarea(selector: string) {
		return this.required<HTMLTextAreaElement>(selector);
	}

	private button(selector: string) {
		return this.required<HTMLButtonElement>(selector);
	}

	private required<T extends Element>(selector: string): T {
		const element = this.querySelector<T>(selector);
		if (!element)
			throw new Error(`Notebook admin element is missing: ${selector}`);
		return element;
	}
}

function createText<K extends keyof HTMLElementTagNameMap>(
	tag: K,
	className: string,
	text: string,
) {
	const element = document.createElement(tag);
	element.className = className;
	element.textContent = text;
	return element;
}

function compressImage(file: File, maxWidth: number) {
	return new Promise<string>((resolve, reject) => {
		const reader = new FileReader();
		reader.onerror = reject;
		reader.onload = () => {
			const image = new Image();
			image.onerror = reject;
			image.onload = () => {
				const scale = Math.min(1, maxWidth / image.width);
				const canvas = document.createElement("canvas");
				canvas.width = Math.max(1, Math.round(image.width * scale));
				canvas.height = Math.max(1, Math.round(image.height * scale));
				const context = canvas.getContext("2d");
				if (!context) {
					reject(new Error("Canvas is unavailable"));
					return;
				}
				context.drawImage(image, 0, 0, canvas.width, canvas.height);
				resolve(canvas.toDataURL("image/jpeg", 0.85));
			};
			image.src = String(reader.result || "");
		};
		reader.readAsDataURL(file);
	});
}

function adminErrorMessage(error: unknown) {
	if (error instanceof NotebookAdminApiError) {
		if (error.status === 401) return "管理 Token 无效。";
		if (error.status === 503) return "服务端尚未配置笔记本管理 Token。";
	}
	return error instanceof Error ? error.message : "认证失败。";
}

function readToken() {
	try {
		return window.sessionStorage.getItem(TOKEN_STORAGE_KEY) || "";
	} catch {
		return "";
	}
}

function writeToken(token: string) {
	try {
		window.sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
	} catch {
		// 无会话存储时仍可在当前页面使用。
	}
}

function removeToken() {
	try {
		window.sessionStorage.removeItem(TOKEN_STORAGE_KEY);
	} catch {
		// 忽略不可用的会话存储。
	}
}

if (!customElements.get("notebook-admin")) {
	customElements.define("notebook-admin", NotebookAdminElement);
}
