import { definePlugin } from "@monti-cms/core";
import { collapsibleBlock } from "./definition";

export { collapsibleBlock } from "./definition";

/**
 * Collapsible block (`:::collapsible`). An area that expands when its title is clicked. Add it to the site config's `plugins`.
 *
 * ```ts
 * plugins: [collapsible()]
 * ```
 *
 * For the public page, this extension provides a default public component (`render`, used by `@monti-cms/core/render`). A site can override it with a component of the same name.
 */
export const collapsible = () =>
	definePlugin({
		name: "collapsible",
		options: {},
		blocks: [collapsibleBlock],
		admin: () => import("@monti-cms/blocks/collapsible/admin"),
		render: () => import("@monti-cms/blocks/collapsible/render"),
	});
