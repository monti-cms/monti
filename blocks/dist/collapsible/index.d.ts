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
export declare const collapsible: () => import("@monti-cms/core").CmsPlugin<"collapsible", {}, readonly [{
    readonly name: "collapsible";
    readonly label: string;
    readonly description: string;
    readonly syntax: {
        readonly kind: "container";
        readonly directive: "collapsible";
    };
    readonly component: "Collapsible";
    readonly attributes: {
        readonly title: {
            readonly type: "string";
            readonly label: string;
            readonly translatable: true;
        };
        readonly defaultOpen: {
            readonly type: "boolean";
            readonly label: string;
            readonly defaultValue: false;
        };
    };
    readonly translateInside: true;
    readonly editor: {
        readonly view: "node";
        readonly insertable: true;
        readonly keywords: string[];
        readonly icon: "chevrons-up-down";
        readonly insert: {
            values: {
                title: string;
            };
            text: string;
        };
    };
}]> & {
    readonly contributes?: Readonly<Record<string, unknown>> | undefined;
};
