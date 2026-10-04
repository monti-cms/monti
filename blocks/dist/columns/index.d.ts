export { columnBlock, columnsBlock } from "./definition.js";
/**
 * Columns block (2 to 4 `:::column` inside `::::columns`). Add it to the site config's `plugins`.
 *
 * ```ts
 * plugins: [columns()]
 * ```
 *
 * For the public page, this extension provides a default public component (`render`, used by `@monti-cms/core/render`). A site can override it with a component of the same name.
 */
export declare const columns: () => import("@monti-cms/core").CmsPlugin<"columns", {}> & {
    readonly contributes?: Readonly<Record<string, unknown>> | undefined;
};
export * from "./layout.js";
