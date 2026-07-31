export const NAV_MENU_TOGGLE_EVENT = "firefly:navigation-menu-toggle" as const;

export interface ShellEventMap {
	[NAV_MENU_TOGGLE_EVENT]: { source: "navbar" | "mobile-dock" };
}
