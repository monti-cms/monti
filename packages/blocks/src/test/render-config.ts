import { defineConfig } from "@monti-cms/core";
import { createSite } from "@monti-cms/core/client";
import { category, memo, post, series, tag } from "../../../core/test/cms.config";
import { allBlocks } from "./all-blocks";

/**
 * Config used by the public page rendering tests. It uses the same collection as the core example config, but adds the blocks as a plugin (`callout()`, `tabs()`, ...) rather than as definitions,
 * so that `@monti-cms/core/render` loads each plugin's public component (`render`).
 */
export const renderConfig = defineConfig({
	collections: { post, memo, category, tag, collection: series },
	locales: [
		{ code: "ko", name: "한국어", label: "한국어" },
		{ code: "en", name: "English", label: "영어" },
	],
	defaultLocale: "ko",
	site: { url: "https://example.com", name: "example" },
	timeZone: "Asia/Seoul",
	plugins: allBlocks(),
});

/** The site of `renderConfig`: pass it to `renderMdx` / `renderDocument` (`{ site }`) and to `SiteProvider`. */
export const renderSite = createSite(renderConfig);
