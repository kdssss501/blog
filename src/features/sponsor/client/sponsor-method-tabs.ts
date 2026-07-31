class SponsorMethodTabsElement extends HTMLElement {
	private resizeObserver: ResizeObserver | null = null;

	private readonly handleClick = (event: Event) => {
		const target = event.target as Element | null;
		const button = target?.closest<HTMLButtonElement>("[data-sponsor-tab]");
		if (!button || !this.contains(button)) return;
		this.activate(button.dataset.sponsorTab || "0");
	};

	connectedCallback() {
		this.addEventListener("click", this.handleClick);
		const navigation = this.querySelector<HTMLElement>(
			"[data-sponsor-tab-nav]",
		);
		if (navigation) {
			this.resizeObserver = new ResizeObserver(() => this.updateIndicator());
			this.resizeObserver.observe(navigation);
		}
		requestAnimationFrame(() => this.activate(this.dataset.initialTab || "0"));
	}

	disconnectedCallback() {
		this.removeEventListener("click", this.handleClick);
		this.resizeObserver?.disconnect();
	}

	private activate(tab: string) {
		this.querySelectorAll<HTMLButtonElement>("[data-sponsor-tab]").forEach(
			(button) => {
				const active = button.dataset.sponsorTab === tab;
				button.classList.toggle("sponsor-qr-card__tab-btn--active", active);
				button.classList.toggle("sponsor-qr-card__tab-btn--inactive", !active);
				button.setAttribute("aria-selected", String(active));
			},
		);
		this.querySelectorAll<HTMLElement>("[data-sponsor-panel]").forEach(
			(panel) => {
				panel.hidden = panel.dataset.sponsorPanel !== tab;
			},
		);
		requestAnimationFrame(() => this.updateIndicator());
	}

	private updateIndicator() {
		const navigation = this.querySelector<HTMLElement>(
			"[data-sponsor-tab-nav]",
		);
		const indicator = navigation?.querySelector<HTMLElement>(
			"[data-sponsor-tab-indicator]",
		);
		const active = navigation?.querySelector<HTMLElement>(
			".sponsor-qr-card__tab-btn--active",
		);
		if (!navigation || !indicator || !active) return;
		const navigationRect = navigation.getBoundingClientRect();
		const buttonRect = active.getBoundingClientRect();
		indicator.style.transform = `translate(${buttonRect.left - navigationRect.left}px, ${buttonRect.top - navigationRect.top}px)`;
		indicator.style.width = `${buttonRect.width}px`;
		indicator.style.height = `${buttonRect.height}px`;
		indicator.style.opacity = "1";
	}
}

if (!customElements.get("sponsor-method-tabs")) {
	customElements.define("sponsor-method-tabs", SponsorMethodTabsElement);
}
