export { tooltipBlock } from "./definition.js";
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
export declare const tooltip: () => import("@monti-cms/core").CmsPlugin<"tooltip", {}, readonly [{
    readonly name: "tooltip";
    readonly label: string;
    readonly syntax: {
        readonly kind: "text";
        readonly directive: "tooltip";
    };
    readonly component: "Tooltip";
    readonly attributes: {
        readonly content: {
            readonly type: "string";
            readonly label: string;
            readonly required: true;
            readonly translatable: true;
        };
    };
    readonly editor: {
        readonly view: "mark";
    };
}]> & {
    readonly contributes?: Readonly<Record<string, unknown>> | undefined;
};
