import { definePlugin } from "@monti-cms/core";
import { columnBlock, columnsBlock } from "./definition";

export { columnBlock, columnsBlock } from "./definition";

/**
 * Columns block (2 to 4 `:::column` inside `::::columns`). Add it to the site config's `plugins`.
 *
 * ```ts
 * plugins: [columns()]
 * ```
 *
 * For the public page, this extension provides a default public component (`render`, used by `@monti-cms/core/render`). A site can override it with a component of the same name.
 */
export const columns = () =>
	definePlugin({
		name: "columns",
		options: {},
		blocks: [columnsBlock, columnBlock],
		admin: () => import("@monti-cms/blocks/columns/admin"),
		render: () => import("@monti-cms/blocks/columns/render"),
	});

export * from "./layout";
