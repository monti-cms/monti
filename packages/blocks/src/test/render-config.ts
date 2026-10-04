import { defineConfig } from "@monti-cms/core";
import { category, memo, post, series, tag } from "../../../core/test/cms.config";
import { blocks } from "../index";

/**
 * Config used by the public page rendering tests. It uses the same collection as the core example config, but adds the blocks as a plugin (`blocks()`) rather than as definitions,
 * so that `@monti-cms/core/render` loads each plugin's public component (`render`).
 */
export default defineConfig({
	collections: { post, memo, category, tag, collection: series },
	locales: [
		{ code: "ko", name: "한국어", label: "한국어" },
		{ code: "en", name: "English", label: "영어" },
	],
	defaultLocale: "ko",
	site: { url: "https://example.com", name: "example" },
	timeZone: "Asia/Seoul",
	plugins: [...blocks()],
});
