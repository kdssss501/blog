import {
	ActivityAdminApiError,
	deleteAdminActivity,
	fetchAdminActivities,
	saveAdminActivity,
	verifyActivityAdminToken,
} from "../data/activity-admin-api";
import {
	type ActivityImage,
	type ActivityRecord,
	buildGptImageUrl,
} from "../model/activity-content";

const TOKEN_STORAGE_KEY = "activity_admin_token";

class ActivityAdminElement extends HTMLElement {
	private eventController: AbortController | undefined;
	private token = "";
	private currentSlug = "";
	private images: ActivityImage[] = [];

	connectedCallback() {
		this.eventController?.abort();
		this.eventController = new AbortController();
		const signal = this.eventController.signal;
		this.querySelector("[data-activity-login]")?.addEventListener(
			"click",
			this.handleLogin,
			{ signal },
		);
		this.querySelector("[data-activity-token]")?.addEventListener(
			"keydown",
			this.handleTokenKeydown,
			{ signal },
		);
		this.querySelector("[data-activity-new]")?.addEventListener(
			"click",
			() => this.fillForm(),
			{ signal },
		);
		this.querySelector("[data-activity-save]")?.addEventListener(
			"click",
			this.handleSave,
			{ signal },
		);
		this.querySelector("[data-activity-delete]")?.addEventListener(
			"click",
			this.handleDelete,
			{ signal },
		);
		this.querySelector("[data-activity-generate-image]")?.addEventListener(
			"click",
			this.handleGenerateImage,
			{ signal },
		);

		this.token = readToken();
		this.renderImages();
		if (this.token) void this.authenticate(this.token);
		else this.showLogin();
	}

	disconnectedCallback() {
		this.eventController?.abort();
	}

	private readonly handleTokenKeydown = (event: Event) => {
		if ((event as KeyboardEvent).key === "Enter") this.handleLogin();
	};

	private readonly handleLogin = () => {
		const token = this.input("[data-activity-token]").value.trim();
		if (!token) {
			this.setLoginError("请输入管理 Token。");
			return;
		}
		void this.authenticate(token);
	};

	private async authenticate(token: string) {
		this.setLoginError("");
		this.setLoginBusy(true);
		try {
			await verifyActivityAdminToken(token);
			this.token = token;
			writeToken(token);
			this.required<HTMLElement>("[data-activity-login-panel]").hidden = true;
			this.required<HTMLElement>("[data-activity-admin-panel]").hidden = false;
			this.fillForm();
			await this.loadActivities();
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
			"[data-activity-login-panel]",
		);
		const panel = this.querySelector<HTMLElement>(
			"[data-activity-admin-panel]",
		);
		if (login) login.hidden = false;
		if (panel) panel.hidden = true;
	}

	private async loadActivities() {
		const items = await fetchAdminActivities(this.token);
		this.renderActivities(items);
	}

	private renderActivities(items: ActivityRecord[]) {
		const list = this.querySelector<HTMLElement>("[data-activity-list]");
		if (!list) return;
		if (items.length === 0) {
			list.replaceChildren(
				createText("p", "activity-admin-muted", "还没有动态内容。"),
			);
			return;
		}
		list.replaceChildren(
			...items.map((item) => {
				const button = createText("button", "activity-admin-list-item", "");
				button.type = "button";
				button.append(
					createText(
						"span",
						"activity-admin-list-item__title",
						item.title || "未命名动态",
					),
					createText(
						"span",
						"activity-admin-list-item__meta",
						item.excerpt || "",
					),
				);
				button.addEventListener("click", () => this.fillForm(item), {
					signal: this.eventController?.signal,
				});
				return button;
			}),
		);
	}

	private fillForm(item?: ActivityRecord) {
		this.currentSlug = item?.slug || "";
		this.images = Array.isArray(item?.images) ? [...item.images] : [];
		this.input("[data-activity-title]").value = item?.title || "";
		this.input("[data-activity-excerpt]").value = item?.excerpt || "";
		this.textarea("[data-activity-content]").value =
			item?.body || item?.content || "";
		this.renderImages();
		this.setMessage("", "");
	}

	private renderImages() {
		const list = this.querySelector<HTMLElement>("[data-activity-image-list]");
		if (!list) return;
		if (this.images.length === 0) {
			list.replaceChildren(
				createText("p", "activity-admin-muted", "还没有插入图片。"),
			);
			return;
		}
		list.replaceChildren(
			...this.images.map((image, index) => {
				const item = document.createElement("div");
				item.className = "activity-admin-image-item";
				const preview = document.createElement("img");
				preview.src = image.url;
				preview.alt = image.alt || "动态图片";
				preview.loading = "lazy";
				const meta = document.createElement("div");
				meta.className = "activity-admin-image-item__meta";
				const remove = createText("button", "activity-admin-btn", "移除");
				remove.type = "button";
				remove.addEventListener(
					"click",
					() => {
						this.images.splice(index, 1);
						this.renderImages();
					},
					{ signal: this.eventController?.signal },
				);
				meta.append(
					createText("span", "", image.alt || `图片 ${index + 1}`),
					remove,
				);
				item.append(preview, meta);
				return item;
			}),
		);
	}

	private readonly handleGenerateImage = () => {
		const promptInput = this.input("[data-activity-image-prompt]");
		const prompt = promptInput.value.trim();
		if (!prompt) {
			this.setMessage("先输入图片提示词。", "error");
			return;
		}
		const image: ActivityImage = {
			url: buildGptImageUrl(prompt, "landscape_4_3"),
			alt: prompt.slice(0, 24),
			prompt,
			source: "gpt",
		};
		this.images.push(image);
		const content = this.textarea("[data-activity-content]");
		content.value = `${content.value.trim()}${content.value.trim() ? "\n\n" : ""}![${image.alt}](${image.url})`;
		promptInput.value = "";
		this.renderImages();
		this.setMessage("图片已插入正文。", "success");
	};

	private readonly handleSave = async () => {
		const input = {
			title: this.input("[data-activity-title]").value.trim(),
			excerpt: this.input("[data-activity-excerpt]").value.trim(),
			content: this.textarea("[data-activity-content]").value.trim(),
			images: this.images,
		};
		if (!input.title || !input.content) {
			this.setMessage("标题和正文不能为空。", "error");
			return;
		}
		const button = this.button("[data-activity-save]");
		button.disabled = true;
		try {
			const saved = await saveAdminActivity(
				this.token,
				input,
				this.currentSlug || undefined,
			);
			this.fillForm(saved);
			await this.loadActivities();
			this.setMessage("动态已保存。", "success");
		} catch (error) {
			this.handleAdminError(error, "保存失败");
		} finally {
			button.disabled = false;
		}
	};

	private readonly handleDelete = async () => {
		if (!this.currentSlug) {
			this.setMessage("请先选择要删除的动态。", "error");
			return;
		}
		if (!window.confirm("确定删除这条动态吗？")) return;
		try {
			await deleteAdminActivity(this.token, this.currentSlug);
			this.fillForm();
			await this.loadActivities();
			this.setMessage("动态已删除。", "success");
		} catch (error) {
			this.handleAdminError(error, "删除失败");
		}
	};

	private handleAdminError(error: unknown, fallback: string) {
		this.clearTokenIfUnauthorized(error);
		if (
			error instanceof ActivityAdminApiError &&
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
			error instanceof ActivityAdminApiError &&
			(error.status === 401 || error.status === 503)
		) {
			this.token = "";
			removeToken();
		}
	}

	private setMessage(message: string, type: "" | "success" | "error") {
		const target = this.querySelector<HTMLElement>("[data-activity-message]");
		if (!target) return;
		target.textContent = message;
		target.dataset.state = type;
	}

	private setLoginError(message: string) {
		const target = this.querySelector<HTMLElement>(
			"[data-activity-login-error]",
		);
		if (target) target.textContent = message;
	}

	private setLoginBusy(busy: boolean) {
		const button = this.querySelector<HTMLButtonElement>(
			"[data-activity-login]",
		);
		if (!button) return;
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
			throw new Error(`Activity admin element is missing: ${selector}`);
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

function adminErrorMessage(error: unknown) {
	if (error instanceof ActivityAdminApiError) {
		if (error.status === 401) return "管理 Token 无效。";
		if (error.status === 503) return "服务端尚未配置动态管理 Token。";
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

if (!customElements.get("activity-admin")) {
	customElements.define("activity-admin", ActivityAdminElement);
}
