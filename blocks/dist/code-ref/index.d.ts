export { codeRefBlock } from "./definition.js";
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
export declare const codeRef: () => import("@monti-cms/core").CmsPlugin<"code-ref", {}, readonly [{
    readonly name: "code-ref";
    readonly label: string;
    readonly syntax: {
        readonly kind: "text";
        readonly directive: "code-ref";
    };
    readonly component: "CodeRef";
    readonly attributes: {
        readonly to: {
            readonly type: "string";
            readonly label: string;
            readonly required: true;
            readonly codeAnchor: true;
        };
    };
    readonly editor: {
        readonly view: "mark";
    };
}]> & {
    readonly contributes?: Readonly<Record<string, unknown>> | undefined;
};
