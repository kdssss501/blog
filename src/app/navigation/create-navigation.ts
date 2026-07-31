import type { NavBarConfig, NavBarLink, SiteConfig } from "../../types/config";
import {
	type FeatureId,
	featureRegistry,
	isFeatureEnabled,
} from "../features/feature-registry.ts";

function createFeatureLink(id: FeatureId): NavBarLink {
	const feature = featureRegistry[id];
	return {
		name: feature.label,
		url: feature.path,
		icon: feature.icon,
	};
}

export function createNavigation(pageFlags: SiteConfig["pages"]): NavBarConfig {
	const enabledLinks = (ids: FeatureId[]) =>
		ids.filter((id) => isFeatureEnabled(id, pageFlags)).map(createFeatureLink);

	const articles: NavBarLink = {
		name: "文章",
		url: "/posts/",
		icon: "material-symbols:article-outline-rounded",
		children: enabledLinks(["postList", "categories", "archive", "write"]),
	};
	const activity: NavBarLink = {
		name: "动态",
		url: "/moments/",
		icon: "material-symbols:dynamic-feed-rounded",
		children: enabledLinks([
			"activity",
			"album",
			"guestbook",
			"notebook",
			"friendFeed",
		]),
	};
	const records: NavBarLink = {
		name: "记录",
		url: "/books/",
		icon: "material-symbols:bookmarks-outline-rounded",
		children: enabledLinks([
			"books",
			"moviesGames",
			"music",
			"changelog",
			"calendar",
			"routines",
			"places",
		]),
	};
	const about: NavBarLink = {
		name: "关于",
		url: "/about/",
		icon: "material-symbols:person-outline-rounded",
		children: enabledLinks(["about", "friends", "sponsor", "config"]),
	};

	return {
		links: [
			createFeatureLink("home"),
			...enabledLinks(["xiao"]),
			articles,
			...enabledLinks(["collections"]),
			activity,
			records,
			about,
		],
	};
}
