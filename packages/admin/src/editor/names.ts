import type { Catalog } from "./catalog";

/**
 * The editor's names for blocks and marks: a leaf module, so the editor's parts that need a name (the commands, dragging and picking blocks, the code
 * tools) do not import the schema, which imports the block views that use them.
 */

/** The editor's node for a block type: a block type may hold `:` or `-` (`component:PostCard`), an editor name may not. */
export const nodeName = (type: string) => type.replace(/[^A-Za-z0-9_]/g, "_");

/** A block whose type the site no longer defines: kept whole in one attr, drawn as a box, never changed (doc 03, 03-5). */
export const UNKNOWN = "unknownBlock";
/** A mark the site no longer defines, kept whole on its text. */
export const KEPT_MARK = "keptMark";

/** The core marks whose editor name differs from their stored name. */
export const MARK_NAMES: Record<string, string> = { sup: "superscript", sub: "subscript" };
export const CORE_MARKS = new Set(["bold", "italic", "underline", "strike", "code", "link", "sup", "sub"]);
export const markName = (type: string) =>
	MARK_NAMES[type] ?? (CORE_MARKS.has(type) ? type : `monti_${type.replace(/[^A-Za-z0-9_]/g, "_")}`);
export const markType = (name: string, kit?: Catalog) =>
	kit?.marks.find((mark) => markName(mark.type) === name)?.type ??
	Object.entries(MARK_NAMES).find(([, editor]) => editor === name)?.[0] ??
	name;
