import type { Root } from "mdast";
/**
 * A line break is written as `<br />` followed by a line ending (`line<br />` + newline + `next`) so a paragraph reads well in source.
 * The line ending after the element is not content, so it is removed: otherwise the document would hold a stray newline in the text after every break
 * (and a renderer that turns newlines into breaks would break the line twice).
 */
export declare const remarkBreakNewline: () => (tree: Root) => undefined;
