import type { TextFinding } from "@monti-cms/core";
import type { Editor } from "@tiptap/core";
import type { Node as EditorNode } from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";

/** A block's words as a text check reads them, and where each run of them sits in the document. */
type BlockText = { id: string; text: string; runs: { at: number; pos: number; length: number }[] };

/** What stands in a block's text for something that is not words: a line break as itself, anything else (a footnote's mark) as one sign. */
const BREAK = "\n";
const NOT_WORDS = "\uFFFC";

/** The most blocks one check is handed (`plugins.checkText` takes no more): a longer body is checked up to there. */
const MOST_BLOCKS = 2000;

/**
 * The text of every block that holds prose, by block id: its text nodes in order, a line break as a line break and any other inline thing
 * as one sign, so the words on either side of one are never read as one word. `runs` take a place in the words back to the document.
 * Code is not prose and is left out. A table's cells have no block of their own and are not checked.
 */
export function blockTexts(doc: EditorNode): BlockText[] {
	const blocks: BlockText[] = [];
	doc.descendants((node, pos) => {
		if (!node.isTextblock) return true;
		const id = node.attrs.blockId as string | undefined;
		if (!id || node.type.spec.code || blocks.length >= MOST_BLOCKS) return false;
		const block: BlockText = { id, text: "", runs: [] };
		node.forEach((child, offset) => {
			if (child.isText && child.text) {
				block.runs.push({ at: block.text.length, pos: pos + 1 + offset, length: child.text.length });
				block.text += child.text;
			} else block.text += child.type.name === "hardBreak" ? BREAK : NOT_WORDS;
		});
		if (block.runs.length > 0) blocks.push(block);
		return false;
	});
	return blocks;
}

/** A place in a block's text as a place in the document; `null` when the text has no such place. `end` reads it as where a range stops. */
function positionOf(block: BlockText, at: number, end: boolean): number | null {
	for (const run of block.runs) {
		const inside = end ? at > run.at && at <= run.at + run.length : at >= run.at && at < run.at + run.length;
		if (inside) return run.pos + (at - run.at);
	}
	return null;
}

/** A finding with the words it was found over: it is the same finding only while those words are still there. */
export type Found = TextFinding & { was: string };

/** Where a finding is in the document now; `null` once its block or its words have changed since the check. */
function rangeOf(doc: EditorNode, found: Found): { from: number; to: number } | null {
	const block = blockTexts(doc).find((each) => each.id === found.block);
	if (!block || block.text.slice(found.from, found.to) !== found.was) return null;
	// Words alone are replaced: a finding that reaches over a line break or a footnote's mark would take it out with them.
	if (found.was.includes(BREAK) || found.was.includes(NOT_WORDS)) return null;
	const from = positionOf(block, found.from, false);
	const to = positionOf(block, found.to, true);
	return from === null || to === null ? null : { from, to };
}

/** Whether a finding can be put in: its words are where the check found them, and are words alone. */
export const stands = (doc: EditorNode, found: Found) => rangeOf(doc, found) !== null;

/**
 * Puts the findings' words in the body, in one step a single undo takes back. Each keeps the marks of the words it replaces. A finding
 * whose words changed since the check is left out. Says how many went in.
 */
export function fixInEditor(editor: Editor, findings: readonly Found[]): number {
	const { state } = editor;
	const ranges = findings
		.flatMap((found) => {
			const range = rangeOf(state.doc, found);
			return range ? [{ ...range, words: found.replacement }] : [];
		})
		// From the end, so a replacement does not move the ones before it; one that overlaps a later one is left for the next check.
		.sort((a, b) => b.from - a.from);
	const tr = state.tr;
	let before = Number.POSITIVE_INFINITY;
	let done = 0;
	for (const range of ranges) {
		if (range.to > before) continue;
		if (range.words === "") tr.delete(range.from, range.to);
		else tr.insertText(range.words, range.from, range.to);
		before = range.from;
		done += 1;
	}
	if (done > 0) editor.view.dispatch(tr);
	return done;
}

/** Shows a finding in the body: its words selected and scrolled to. */
export function showInEditor(editor: Editor, found: Found): boolean {
	const range = rangeOf(editor.state.doc, found);
	if (!range) return false;
	editor.view.dispatch(
		editor.state.tr.setSelection(TextSelection.create(editor.state.doc, range.from, range.to)).scrollIntoView(),
	);
	editor.view.focus();
	return true;
}
