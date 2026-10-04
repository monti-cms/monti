import { definePlugin } from "@monti-cms/core";
import { codeRefBlock } from "./definition";

export { codeRefBlock } from "./definition";

/**
 * Code ref (`:code-ref[text]{to="c1"}`). Add it to the site config's `plugins`.
 *
 * ```ts
 * plugins: [codeRef()]
 * ```
 *
 * In the editor, start by selecting text and pressing `Code link` and then picking a code block line, or from the code block line menu's link-to-body item.
 * Line anchors (the `anchor` line effect) and the linking view are core code block features; this extension provides the body-side mark and bubble.
 * For the public page, this extension provides a default public component (`render`, used by `@monti-cms/core/render`). A site can override it with a component of the same name.
 */
export const codeRef = () =>
	definePlugin({
		name: "code-ref",
		options: {},
		blocks: [codeRefBlock],
		admin: () => import("@monti-cms/blocks/code-ref/admin"),
		render: () => import("@monti-cms/blocks/code-ref/render"),
	});
