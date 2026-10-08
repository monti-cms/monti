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
export declare const callout: () => import("@monti-cms/core").CmsPlugin<"callout", {}, readonly [{
    readonly name: "callout";
    readonly label: string;
    readonly description: string;
    readonly syntax: {
        readonly kind: "container";
        readonly directive: "callout";
    };
    readonly component: "Callout";
    readonly attributes: {
        readonly variant: {
            readonly type: "string";
            readonly label: string;
            readonly options: {
                readonly note: string;
                readonly tip: string;
                readonly info: string;
                readonly warning: string;
                readonly danger: string;
            };
            readonly defaultValue: "note";
        };
        readonly title: {
            readonly type: "string";
            readonly label: string;
            readonly translatable: true;
        };
    };
    readonly children: {
        readonly min: 0;
    };
    readonly translateInside: true;
    readonly editor: {
        readonly view: "node";
        readonly insertable: true;
        readonly keywords: string[];
        readonly icon: "message-square-warning";
        readonly insert: {
            values: {
                variant: string;
            };
            text: string;
        };
    };
}]> & {
    readonly contributes?: Readonly<Record<string, unknown>> | undefined;
};
