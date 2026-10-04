export { tabBlock, tabsBlock } from "./definition.js";
/**
 * Tabs block (2 to 8 `:::tab` inside `::::tabs`). Add it to the site config's `plugins`.
 *
 * ```ts
 * plugins: [tabs()]
 * ```
 *
 * For the public page, this extension provides a default public component (`render`, used by `@monti-cms/core/render`). A site can override it with a component of the same name.
 */
export declare const tabs: () => import("@monti-cms/core").CmsPlugin<"tabs", {}> & {
    readonly contributes?: Readonly<Record<string, unknown>> | undefined;
};
