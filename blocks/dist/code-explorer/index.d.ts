export { codeExplorerBlock } from "./definition.js";
/**
 * Code explorer block (`:::code-explorer`). A file tree with the code of the picked file. Add it to the site config's `plugins`.
 *
 * ```ts
 * plugins: [codeExplorer()]
 * ```
 *
 * For the public page, this extension provides a default public component (`render`, used by `@monti-cms/core/render`). A site can override it with a component of the same name.
 */
export declare const codeExplorer: () => import("@monti-cms/core").CmsPlugin<"code-explorer", {}, readonly [{
    readonly name: "code-explorer";
    readonly label: string;
    readonly description: string;
    readonly syntax: {
        readonly kind: "container";
        readonly directive: "code-explorer";
    };
    readonly component: "CodeExplorer";
    readonly attributes: {
        readonly open: {
            readonly type: "string";
            readonly label: string;
        };
    };
    readonly children: {
        readonly min: 0;
    };
    readonly editor: {
        readonly view: "node";
        readonly insertable: true;
        readonly keywords: string[];
        readonly icon: "folder-tree";
        readonly insert: {
            readonly codeBlocks: readonly [{
                readonly language: "ts";
                readonly title: "src/index.ts";
            }];
        };
    };
}]> & {
    readonly contributes?: Readonly<Record<string, unknown>> | undefined;
};
