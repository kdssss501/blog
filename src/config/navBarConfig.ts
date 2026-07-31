import { createNavigation } from "../app/navigation/create-navigation";
import { siteConfig } from "./siteConfig";

/** @deprecated Import createNavigation from @/app for new code. */
export const navBarConfig = createNavigation(siteConfig.pages);
