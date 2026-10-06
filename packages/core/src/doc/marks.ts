import { ADDED_MARK_BLOCKS } from "../blocks/active";

/**
 * Mark sort order. The parser of a format, its writer and the editor conversion (`tiptap-content`) must use the same order so that
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

export const sortMarks = <T extends { type: string }>(marks: readonly T[]): T[] =>
	[...marks].sort((left, right) => MARK_ORDER.indexOf(left.type) - MARK_ORDER.indexOf(right.type));
