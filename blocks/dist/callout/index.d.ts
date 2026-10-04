export { calloutBlock } from "./definition.js";
/**
 * Callout block (`:::callout`). A box that highlights content such as notes and warnings. Add it to the site config's `plugins`.
 *
 * ```ts
 * plugins: [callout()]
 * ```
 *
 * For the public page, this extension provides a default public component (`render`, used by `@monti-cms/core/render`). A site can override it with a component of the same name.
 */
export declare const callout: () => import("@monti-cms/core").CmsPlugin<"callout", {}> & {
    readonly contributes?: Readonly<Record<string, unknown>> | undefined;
};
