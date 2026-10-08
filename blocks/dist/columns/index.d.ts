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
export declare const columns: () => import("@monti-cms/core").CmsPlugin<"columns", {}, readonly [{
    readonly name: "columns";
    readonly label: string;
    readonly description: string;
    readonly syntax: {
        readonly kind: "container";
        readonly directive: "columns";
    };
    readonly component: "Columns";
    readonly attributes: {
        readonly widths: {
            readonly type: "string";
            readonly label: string;
            readonly description: string;
        };
    };
    readonly children: {
        readonly blocks: readonly ["column"];
        readonly min: 2;
        readonly max: 4;
    };
    readonly translateInside: true;
    readonly editor: {
        readonly view: "node";
        readonly insertable: true;
        readonly keywords: string[];
        readonly icon: "columns-2";
        readonly insert: {
            children: {
                text: string;
            }[];
        };
    };
}, {
    readonly name: "column";
    readonly label: string;
    readonly syntax: {
        readonly kind: "container";
        readonly directive: "column";
    };
    readonly component: "Column";
    readonly attributes: {};
    readonly parent: "columns";
    readonly translateInside: true;
    readonly editor: {
        readonly view: "node";
    };
}]> & {
    readonly contributes?: Readonly<Record<string, unknown>> | undefined;
};
export * from "./layout.js";
