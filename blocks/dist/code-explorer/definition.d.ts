/**
 * Code explorer (`:::code-explorer`). A file tree with the code of the picked file, for posts that show several files of a project.
 *
 * It holds code blocks, and each code block's `title` is its path (`src/app/page.tsx`): the tree is built from the paths, never drawn by
 * hand. A code block with a path and no code is a file shown only in the tree; a path ending in `/` is a folder (an empty one, or one
 * listed for its own sake). Without any code, the block is just a file tree.
 *
 * ````md
 * :::code-explorer{open="src/app/page.tsx"}
 * ```tsx title="src/app/page.tsx"
 * export default function Page() {}
 * ```
 * ```ts title="src/lib/db.ts"
 * export const db = connect();
 * ```
 * ```text title="public/"
 * ```
 * :::
 * ````
 *
 * Every file stays an ordinary code block: line effects, folding, copy and code-ref links all work, and every file is in the page's HTML
 * (only hidden on screen), so search engines, feeds, readers without JavaScript and exports see titled code blocks one after another.
 */
export declare const codeExplorerBlock: {
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
};
