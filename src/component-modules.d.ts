declare module "*.astro" {
	const component: import("astro/runtime/server/index.js").AstroComponentFactory;
	export default component;
}

declare module "*.svelte" {
	const component: import("svelte").Component;
	export default component;
}
