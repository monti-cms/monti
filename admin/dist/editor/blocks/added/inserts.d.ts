import type { BlockDefinition, Site } from "@monti-cms/core/client";
import type { Editor, JSONContent, Range } from "@tiptap/core";
/**
 * The node to insert from the slash menu. Follows the definition's `editor.insert` (initial value); if absent, uses attribute defaults and an empty body. If child block rules
 * exist, uses the children of the initial value; if absent, inserts as many first child blocks as the minimum count (one if there is no minimum).
 * A body container starts with the initial value's code blocks (`codeBlocks`) if it has any, otherwise with one paragraph.
 */
export declare function insertContentOf(site: Pick<Site, "ADDED_BLOCKS">, block: BlockDefinition): JSONContent;
/** Insert actions of added blocks (slash menu). The key is the block name. */
export declare const addedBlockInsertActions: (site: Pick<Site, "ADDED_BLOCKS">) => Readonly<Record<string, (editor: Editor, range: Range) => void>>;
