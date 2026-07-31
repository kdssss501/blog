class PostFreshnessElement extends HTMLElement {
	connectedCallback() {
		const date = this.dataset.date;
		const threshold = Number(this.dataset.threshold);
		if (!date || !Number.isFinite(threshold)) return;

		const modifiedAt = new Date(date);
		if (Number.isNaN(modifiedAt.getTime())) return;
		const days = Math.floor(
			(Date.now() - modifiedAt.getTime()) / (24 * 60 * 60 * 1_000),
		);
		if (days < threshold) return;

		this.hidden = false;
		const daysText = this.querySelector<HTMLElement>("[data-post-days-ago]");
		const warning = this.querySelector<HTMLElement>(
			"[data-post-outdated-warning]",
		);
		if (days >= 1 && daysText?.dataset.template) {
			daysText.textContent = `，${daysText.dataset.template.replace("{days}", String(days))}`;
			if (warning) warning.hidden = false;
		}
	}
}

if (!customElements.get("post-freshness")) {
	customElements.define("post-freshness", PostFreshnessElement);
}
