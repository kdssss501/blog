class RssCopyElement extends HTMLElement {
	private controller: AbortController | undefined;
	private resetTimer = 0;

	connectedCallback() {
		this.controller?.abort();
		this.controller = new AbortController();
		this.querySelector<HTMLButtonElement>("[data-rss-copy]")?.addEventListener(
			"click",
			this.handleCopy,
			{ signal: this.controller.signal },
		);
	}

	disconnectedCallback() {
		this.controller?.abort();
		window.clearTimeout(this.resetTimer);
	}

	private readonly handleCopy = async (event: Event) => {
		const button = event.currentTarget as HTMLButtonElement;
		const feedUrl = button.dataset.url;
		if (!feedUrl || button.disabled) return;

		button.disabled = true;
		const originalText = button.textContent ?? "";
		try {
			await copyText(feedUrl);
			button.dataset.state = "success";
			button.textContent = button.dataset.copiedText || originalText;
		} catch (error) {
			button.dataset.state = "error";
			button.textContent = button.dataset.failedText || originalText;
			console.error("[rss] copy failed:", error);
		}

		window.clearTimeout(this.resetTimer);
		this.resetTimer = window.setTimeout(() => {
			button.textContent = originalText;
			button.disabled = false;
			delete button.dataset.state;
		}, 2_000);
	};
}

async function copyText(value: string) {
	if (!navigator.clipboard?.writeText) {
		throw new Error("Clipboard API is unavailable");
	}
	await navigator.clipboard.writeText(value);
}

if (!customElements.get("rss-copy")) {
	customElements.define("rss-copy", RssCopyElement);
}
