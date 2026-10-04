import { definePlugin } from "@monti-cms/core";
import { tooltipBlock } from "./definition";

export { tooltipBlock } from "./definition";

/**
 * Tooltip (`:tooltip[text]{content="description"}`). Add it to the site config's `plugins`.
 *
 * ```ts
 * plugins: [tooltip()]
 * ```
 *
 * The editor gets a `Tooltip` item in the format toolbar, text bubble, and slash menu. For the public page, this extension provides a default public component (`render`, used by `@monti-cms/core/render`). A site can override it with a component of the same name.
 * Tooltips on text inside a code block (code fence comments) are a core code block feature, separate from this extension.
 */
export const tooltip = () =>
	definePlugin({
		name: "tooltip",
		options: {},
		blocks: [tooltipBlock],
		admin: () => import("@monti-cms/blocks/tooltip/admin"),
		render: () => import("@monti-cms/blocks/tooltip/render"),
	});
