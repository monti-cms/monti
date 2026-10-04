import { ADDED_BLOCKS, ADDED_MARK_BLOCKS } from "../blocks/active.js";
/** Public renderer names of added blocks (block extensions and site config). */
const ADDED_COMPONENTS = ADDED_BLOCKS.map((block) => block.component);
/** Renderer names of added blocks that are not text decorations. */
const ADDED_BLOCK_COMPONENTS = ADDED_BLOCKS.filter((block) => block.syntax.kind !== "text").map((block) => block.component);
export const REGISTERED_JSX_NAMES = new Set([
    "Untranslated",
    "u",
    "strong",
    "em",
    "del",
    "sup",
    "sub",
    "br",
    "TextAlign",
    "Image",
    "File",
    "CodeBlock",
    "Math",
    "Table",
    "TableRow",
    "TableCell",
    ...ADDED_COMPONENTS,
]);
export const BLOCK_JSX_NAMES = new Set([
    "TextAlign",
    "Image",
    "File",
    "CodeBlock",
    "Math",
    "Table",
    "TableRow",
    "TableCell",
    ...ADDED_BLOCK_COMPONENTS,
]);
/** Text decoration renderer name → document mark name. For added text decorations (block extensions), the block name is the mark name. */
export const INLINE_JSX_MARKS = {
    u: "underline",
    strong: "bold",
    em: "italic",
    del: "strike",
    sup: "superscript",
    sub: "subscript",
    Untranslated: "untranslated",
    ...Object.fromEntries(ADDED_MARK_BLOCKS.map((block) => [block.component, block.name])),
};
/**
 * Mark sort order. The parser (`to-document`), serialization (`serialize`) and editor conversion (`tiptap-content`) must use the same order so that
 * round-trip document comparison does not break because of ordering. Added text decorations come after the translation note (outermost), in the order they were added.
 */
export const MARK_ORDER = [
    "untranslated",
    ...ADDED_MARK_BLOCKS.map((block) => block.name),
    "underline",
    "superscript",
    "subscript",
    "link",
    "bold",
    "italic",
    "strike",
    "code",
];
export const sortMarks = (marks) => [...marks].sort((left, right) => MARK_ORDER.indexOf(left.type) - MARK_ORDER.indexOf(right.type));
/** Names removed in batch 4. If one remains in the body, `analyze` rejects it (read compatibility is also over). */
export const RETIRED_JSX_NAMES = new Set(["ContentLink", "IdeographicSpace"]);
/** Event handler attribute names. React does not preserve case, so `onerror` is blocked as well. */
export const EVENT_HANDLER_NAME = /^on[a-z]/i;
