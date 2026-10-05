import { defineConfig } from "@monti-cms/core";
import { callout, chart, codeExplorer, collapsible, columns, mermaid, tabs } from "../../blocks/src";
import { ALL_BLOCKS } from "../../blocks/src/definitions";
import base from "../../core/test/cms.config";
import { seo } from "../../seo/src";
import { aiPlugin } from "../src";

/**
 * The core package's example blog config plus the same plugins as the reference blog (block extension, SEO extension, AI). Used by the AI plugin tests.
 * AI actions are not listed as in the blog: the default actions and those added by the block and SEO extensions turn on automatically.
 */
export default defineConfig({
	...base,
	// The block extension's blocks are added by the plugin (block AI actions come with it). What remains is the example user block.
	blocks: (base.blocks ?? []).filter((block) => !(ALL_BLOCKS as readonly unknown[]).includes(block)),
	plugins: [
		callout(),
		collapsible(),
		tabs(),
		columns(),
		codeExplorer(),
		mermaid(),
		chart(),
		seo(),
		aiPlugin({
			siteDescription: "개인 기술 블로그",
			shared: {
				styleGuide: { label: "문체 가이드", text: "" },
			},
		}),
	],
});
