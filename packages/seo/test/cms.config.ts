import { defineConfig } from "@monti-cms/core";
import { aiPlugin } from "../../ai/src";
import base from "../../core/test/cms.config";
import { seo } from "../src";

/** The core package's example blog config (SEO fields via `seoFields`) plus the SEO and AI plugins. Used by the SEO extension tests. */
export default defineConfig({
	...base,
	plugins: [seo(), aiPlugin({ siteDescription: "개인 기술 블로그" })],
});
