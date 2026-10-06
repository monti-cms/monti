import type { BrowserFormat } from "@monti-cms/admin";
import { BLOCK_ID_ATTRIBUTE, findBlock as findBlockById, UNTRANSLATED_MARK_NAME } from "@monti-cms/admin/editor";
import type { Editor, JSONContent } from "@tiptap/core";
import { Fragment, type Node as PmNode } from "@tiptap/pm/model";
import { contentOfText, textOfContent } from "./mdx-format";

/**
 * Units of AI translation. A unit is the single block a block handle points to, or the blocks that Translate all collects.
 *
 * - A list item is a unit. An item alone is not valid MDX, so it is wrapped in a list of the same kind (one item) before sending,
 *   and the item is taken from the returned list to replace only that item's position.
 * - Blocks inside callouts, quotes and tabs are valid MDX on their own, so they are sent as they are.
 * - When replacing, it checks that the result fits the same position in the same shape. If not, nothing is replaced (lists are not split).
 */

const LISTS = new Set(["bulletList", "orderedList", "taskList"]);
const LIST_ITEMS = new Set(["listItem", "taskItem"]);

export interface TranslateUnit {
	/** Source MDX to send (with the notice markers stripped). */
	mdx: string;
	/** JSON of the block to replace. Used to see whether the user edited it in the meantime. */
	original: string;
	/** For a list item, the kind of the wrapping list. */
	wrap: string | null;
}

export type ApplyResult = "replaced" | "changed" | "invalid";

/** Whether a translation notice remains in the block. */
export function hasHints(node: PmNode): boolean {
	let found = false;
	node.descendants((child) => {
		if (found) return false;
		if (child.marks.some((mark) => mark.type.name === UNTRANSLATED_MARK_NAME)) found = true;
		return !found;
	});
	return found;
}

/** JSON with the notice markers stripped. The notice text is the original, so this is the source block itself. */
const withoutHints = (json: JSONContent): JSONContent => ({
	...json,
	...(json.marks ? { marks: json.marks.filter((mark) => mark.type !== UNTRANSLATED_MARK_NAME) } : {}),
	...(json.content ? { content: json.content.map(withoutHints) } : {}),
});

/** Source MDX of a block (JSON), written by the `mdx` format. */
export const sourceMdxFromJson = (format: BrowserFormat, json: JSONContent) =>
	textOfContent(format, [withoutHints(json)]);

/** Translation unit of one block. `parent` is the node that contains the block. */
export function unitOf(format: BrowserFormat, node: PmNode, parent: PmNode | null): TranslateUnit {
	const json = node.toJSON() as JSONContent;
	const wrap = LIST_ITEMS.has(node.type.name) && parent && LISTS.has(parent.type.name) ? parent : null;
	const sent = wrap ? { type: wrap.type.name, attrs: wrap.attrs, content: [json] } : json;
	return { mdx: sourceMdxFromJson(format, sent), original: JSON.stringify(json), wrap: wrap?.type.name ?? null };
}

/** Translation unit at a block handle position (`pos` is right before the block). `null` if there is no notice. */
export function unitAt(format: BrowserFormat, doc: PmNode, pos: number): TranslateUnit | null {
	const node = doc.nodeAt(pos);
	if (!node || !node.isBlock || !hasHints(node)) return null;
	return unitOf(format, node, doc.resolve(pos).parent);
}

/** Units of Translate all. One per top-level block, and one per item for lists. */
export function collectUnits(format: BrowserFormat, doc: PmNode): TranslateUnit[] {
	const units: TranslateUnit[] = [];
	doc.forEach((node) => {
		if (!hasHints(node)) return;
		if (LISTS.has(node.type.name)) {
			node.forEach((item) => {
				if (hasHints(item)) units.push(unitOf(format, item, node));
			});
		} else units.push(unitOf(format, node, doc));
	});
	return units;
}

/** The block id the original block had (the editor's `blockId`), if any. */
const blockIdOf = (original: string): string | undefined => {
	const id = (JSON.parse(original) as JSONContent).attrs?.[BLOCK_ID_ATTRIBUTE];
	return typeof id === "string" ? id : undefined;
};

/**
 * Position of the original block. A block with an id is found by it, and only while it is unchanged (the same JSON). Otherwise the
 * `hint` position is checked first, then the document is searched for a block with the same JSON.
 */
function findBlock(doc: PmNode, original: string, hint: number | null): { pos: number; size: number } | null {
	const id = blockIdOf(original);
	if (id !== undefined) {
		const pos = findBlockById(doc, id);
		const node = pos === undefined ? null : doc.nodeAt(pos);
		return node && JSON.stringify(node.toJSON()) === original ? { pos: pos as number, size: node.nodeSize } : null;
	}
	const at = hint !== null && hint < doc.content.size ? doc.nodeAt(hint) : null;
	if (at && JSON.stringify(at.toJSON()) === original) return { pos: hint as number, size: at.nodeSize };
	let found: { pos: number; size: number } | null = null;
	doc.descendants((node, pos) => {
		if (found) return false;
		if (node.isBlock && JSON.stringify(node.toJSON()) === original) {
			found = { pos, size: node.nodeSize };
			return false;
		}
		return true;
	});
	return found;
}

/**
 * Replaces the original block with the translation result. If the block changed in the meantime, `changed`; if the result does not fit that position,
 * `invalid`; in both cases the document is untouched.
 */
export function applyTranslation(
	format: BrowserFormat,
	editor: Editor,
	unit: TranslateUnit,
	mdx: string,
	hint: number | null,
): ApplyResult {
	const { state } = editor;
	const target = findBlock(state.doc, unit.original, hint);
	if (!target) return "changed";
	let content = contentOfText(format, mdx);
	if (unit.wrap) {
		const [list] = content;
		if (content.length !== 1 || list?.type !== unit.wrap || list.content?.length !== 1) return "invalid";
		content = list.content;
	}
	// The translated block is the same block: it keeps the original's id (blocks it was split into get new ones).
	const id = blockIdOf(unit.original);
	const [first] = content;
	if (id !== undefined && first)
		content = [{ ...first, attrs: { ...(first.attrs ?? {}), [BLOCK_ID_ATTRIBUTE]: id } }, ...content.slice(1)];
	let nodes: PmNode[];
	try {
		nodes = content.map((json) => state.schema.nodeFromJSON(json));
		for (const node of nodes) node.check();
	} catch {
		return "invalid";
	}
	const $pos = state.doc.resolve(target.pos);
	const index = $pos.index();
	const fragment = Fragment.fromArray(nodes);
	if (nodes.length === 0 || !$pos.parent.canReplace(index, index + 1, fragment)) return "invalid";
	editor.view.dispatch(state.tr.replaceWith(target.pos, target.pos + target.size, fragment));
	return "replaced";
}
