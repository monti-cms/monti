/** A file in the tree. `index` is the position of its entry in the list given to `buildTree` (the code block that holds its code). */
export interface TreeFile {
    readonly kind: "file";
    readonly name: string;
    /** Normalized path (`src/app/page.tsx`). Unique in the tree. */
    readonly path: string;
    readonly index: number;
    /** Whether it has code to show. A file without code is listed only (it cannot be picked). */
    readonly selectable: boolean;
}
/** A folder in the tree, in the order its first entry appeared. */
export interface TreeFolder {
    readonly kind: "folder";
    readonly name: string;
    /** Normalized path without a trailing slash (`src/app`). Unique in the tree. */
    readonly path: string;
    readonly children: readonly TreeNode[];
}
export type TreeNode = TreeFile | TreeFolder;
/** What `buildTree` reads of one code block: its `title` (the path) and whether it has any code. */
export interface TreeEntry {
    readonly path: string;
    readonly code: boolean;
}
export interface BuiltTree {
    readonly nodes: readonly TreeNode[];
    /** Entries that are not in the tree: no usable path, a path already taken (a duplicate, or a file and a folder with one name), or a folder entry holding code. */
    readonly rejected: readonly number[];
}
/**
 * Splits a path into its names. A leading `./` or `/`, `.` and empty segments are ignored and spaces around a name are trimmed (`./src//a.ts` is `src/a.ts`).
 * A path ending in `/` names a folder. Backslashes are not separators.
 */
export declare function parsePath(path: string): {
    readonly segments: readonly string[];
    readonly folder: boolean;
};
/**
 * Builds the tree from the entries' paths. Order is the author's: a folder sits where its first file appears, files and folders are not sorted.
 *
 * - A path ending in `/` is a folder (shown even when empty). A file path makes its folders.
 * - A file with no code is in the tree but not selectable (`selectable: false`).
 * - First wins: a later entry for a path that is already in the tree is `rejected`, and so is a file whose name is a folder (or the reverse). The
 *   caller renders rejected entries as ordinary content, so no code is lost. A folder entry whose path already exists as a folder is just absorbed.
 */
export declare function buildTree(entries: readonly TreeEntry[]): BuiltTree;
/** Every file of the tree in display order (folders walked depth first). */
export declare function filesOf(nodes: readonly TreeNode[]): TreeFile[];
/** Paths of the folders above `path`, outermost first (`a/b/c.ts` gives `a`, `a/b`). */
export declare function ancestorsOf(path: string): string[];
