import { definePlugin } from "@monti-cms/core";
import { tabBlock, tabsBlock } from "./definition";

export { tabBlock, tabsBlock } from "./definition";

/**
 * Tabs block (2 to 8 `:::tab` inside `::::tabs`). Add it to the site config's `plugins`.
 *
 * ```ts
 * plugins: [tabs()]
 * ```
 *
 * For the public page, this extension provides a default public component (`render`, used by `@monti-cms/core/render`). A site can override it with a component of the same name.
 */
export const tabs = () =>
	definePlugin({
		name: "tabs",
		options: {},
		blocks: [tabsBlock, tabBlock],
		admin: () => import("@monti-cms/blocks/tabs/admin"),
		render: () => import("@monti-cms/blocks/tabs/render"),
	});
