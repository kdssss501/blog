import { ARTWORK_PERMISSIONS, ARTWORK_THEMES } from "../shared/content/artwork";

export const illustrationConfig = {
	preferredThemes: ARTWORK_THEMES,
	allowedPermissions: ARTWORK_PERMISSIONS,
	requireAttribution: true,
	allowPixivHotlink: false,
} as const;
