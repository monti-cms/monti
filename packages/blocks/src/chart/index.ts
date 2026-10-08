import { definePlugin } from "@monti-cms/core";
import { chartAiContribution } from "./ai";
import { chartBlock } from "./definition";

export { chartBlock } from "./definition";
export { chartMessages } from "./messages";

/**
 * Chart block (` ```chart `). Add it to `plugins` in the site config.
 *
 * ```ts
 * plugins: [chart()]
 * ```
 *
 * The editor edits with a code input and a preview. The preview is drawn by this extension with recharts (install the optional dependency `recharts`).
 * A site can replace it via `fencePreviews.chart`. The public page is drawn by this extension's default `Chart` component, which a site can override (the code is the `source` attribute,
 * `remarkFenceBlocksToMdx`). Chart colors are the CSS variables `--chart-1` to `--chart-5` (defaults from this package's `render.css` if unset).
 */
export const chart = () =>
	definePlugin({
		name: "chart",
		options: {},
		blocks: [chartBlock],
		// An optional peer of this package: apps that do not use the block do not install it (`monti doctor` checks it).
		requires: ["recharts"],
		admin: () => import("@monti-cms/blocks/chart/admin"),
		render: () => import("@monti-cms/blocks/chart/render"),
		// If the AI plugin is present, the create and edit features attach automatically (`./ai`).
		contributes: { ai: chartAiContribution },
	});

export * from "./dsl";
export { type ChartMessageKey, type ChartText, chartErrorLine, chartErrorMessage } from "./errors";
export * from "./layout";
export * from "./types";
