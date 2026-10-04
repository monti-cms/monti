export { collapsibleBlock } from "./definition.js";
/**
 * Collapsible block (`:::collapsible`). An area that expands when its title is clicked. Add it to the site config's `plugins`.
 *
 * ```ts
 * plugins: [collapsible()]
 * ```
 *
 * For the public page, this extension provides a default public component (`render`, used by `@monti-cms/core/render`). A site can override it with a component of the same name.
 */
export declare const collapsible: () => import("@monti-cms/core").CmsPlugin<"collapsible", {}> & {
    readonly contributes?: Readonly<Record<string, unknown>> | undefined;
};
