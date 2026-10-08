import { defineSite } from "@monti-cms/core";
import { chart } from "../../blocks/src/chart";
import { chartBlock } from "../../blocks/src/definitions";
import base from "../../core/test/other-site.config";
import { seo } from "../../seo/src";
import { aiPlugin, aiPresets } from "../src";

/**
 * The core package's other-site config (article, topic, author; English) plus the block extension (chart), SEO extension, and AI plugin. Field actions
 * attach to this site's fields (`excerpt`, `topicIds`, `authorId`, `metaTitle`...) by kind, role, and relation target, without naming them.
 * Used by the AI plugin tests' other-site suite (`vitest.othersite.config.ts`).
 */
export default defineSite({
	...base,
	blocks: (base.blocks ?? []).filter((block) => block !== chartBlock),
	plugins: [
		chart(),
		seo(),
		aiPlugin({
			siteDescription: "Example site",
			actions: {
				// Turn off and override: turn off media caption suggestions, make summaries short.
				imageCaption: false,
				summary: aiPresets.summary({ maxLength: 200 }),
			},
		}),
	],
});
