import { Extension } from "@tiptap/core";
import type { Node, ResolvedPos } from "@tiptap/pm/model";
import { AllSelection, NodeSelection, Plugin, PluginKey, Selection, TextSelection } from "@tiptap/pm/state";
import type { Mappable } from "@tiptap/pm/transform";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";

/**
 * A selection made from a text that takes in the blocks which are one thing (a picture, a file, a divider) standing after or before it (T194).
 *
 * The browser's own selection ends in text, and so does the editor's reading of it (`TextSelection.between`): where a body ends in pictures and
 * files, a drag or Shift+arrow that starts in the text above them stops at the text's last letter, and only "select all" takes them. So the
 * editor makes this range itself:
 * - Shift+arrow at the edge of a text, with such blocks next and no text beyond them, moves the range's end over one block at a time (with a
 *   text beyond, the browser's own move goes over them into it, as before); coming back, the end goes into the text again.
 * - A drag that starts in a text and comes over such a block (or past the body's last or first one) ends the range on the far side of it.
 *
 * One end of the range is then between two blocks, which a text selection cannot be: {@link RangeOverBlocks}. Copy, cut, delete and typing take
 * what it covers, as with any range. The blocks it covers are marked (`data-covered`), since nothing in them is text for the browser to paint.
 */

/** A block that is one thing: it holds nothing a caret can stand in. */
const isWhole = (node: Node | null | undefined): node is Node => Boolean(node?.isBlock && node.isAtom);

/** Where a {@link RangeOverBlocks} was, for the undo history to put it back. */
class RangeBookmark {
	constructor(
		readonly anchor: number,
		readonly head: number,
	) {}
	map(mapping: Mappable) {
		return new RangeBookmark(mapping.map(this.anchor), mapping.map(this.head));
	}
	resolve(doc: Node) {
		return RangeOverBlocks.at(doc, this.anchor, this.head);
	}
}

/** A range whose head (or anchor) may stand between two blocks, at the far side of a block that is one thing. */
export class RangeOverBlocks extends Selection {
	map(doc: Node, mapping: Mappable): Selection {
		const $anchor = doc.resolve(mapping.map(this.anchor));
		const $head = doc.resolve(mapping.map(this.head));
		// The body changed under it: where both ends are still good it stays; else the nearest text range takes its place.
		return standsWell($anchor) && standsWell($head) && $anchor.pos !== $head.pos
			? new RangeOverBlocks($anchor, $head)
			: TextSelection.between($anchor, $head);
	}

	eq(other: Selection): boolean {
		return other instanceof RangeOverBlocks && other.anchor === this.anchor && other.head === this.head;
	}

	toJSON() {
		return { type: "rangeOverBlocks", anchor: this.anchor, head: this.head };
	}

	getBookmark() {
		return new RangeBookmark(this.anchor, this.head);
	}

	/** The range between two places of a body, or the nearest text range when one of them is no place for it. */
	static at(doc: Node, anchor: number, head: number): Selection {
		const size = doc.content.size;
		const $anchor = doc.resolve(Math.min(Math.max(anchor, 0), size));
		const $head = doc.resolve(Math.min(Math.max(head, 0), size));
		if ($anchor.parent.inlineContent && $head.parent.inlineContent)
			return TextSelection.create(doc, $anchor.pos, $head.pos);
		return standsWell($anchor) && standsWell($head) && $anchor.pos !== $head.pos
			? new RangeOverBlocks($anchor, $head)
			: TextSelection.between($anchor, $head);
	}

	static fromJSON(doc: Node, json: { anchor: number; head: number }) {
		return RangeOverBlocks.at(doc, json.anchor, json.head);
	}
}
try {
	Selection.jsonID("rangeOverBlocks", RangeOverBlocks);
} catch {
	// Named already: this module was loaded a second time (a hot reload).
}

/** Whether an end of the range may stand here: in a text, or between blocks beside one that is one thing. */
function standsWell($pos: ResolvedPos) {
	return $pos.parent.inlineContent || isWhole($pos.nodeBefore) || isWhole($pos.nodeAfter);
}

/**
 * The place between blocks that a head in a text leaves through, going `dir`: after (or before) its text block, and on out of every block it
 * ends (a list's last item) up to where something follows. `null` when nothing follows.
 */
function edgeOf($head: ResolvedPos, dir: 1 | -1): number | null {
	for (let depth = $head.depth; depth > 0; depth--) {
		const at = dir > 0 ? $head.after(depth) : $head.before(depth);
		const $at = $head.doc.resolve(at);
		if (dir > 0 ? $at.nodeAfter : $at.nodeBefore) return at;
	}
	return null;
}

/** Where the range's head goes next from `head`, going `dir`, when the editor must move it itself; `null` when the browser's own move is right. */
function nextHead(view: EditorView, dir: 1 | -1, byLine: boolean): number | null {
	const { selection, doc } = view.state;
	if (selection instanceof NodeSelection || selection instanceof AllSelection) return null;
	const { $head } = selection;
	let at: number | null;
	if ($head.parent.inlineContent) {
		// Only a head that is the range's leading end in this direction, at the edge of its text.
		if (!selection.empty && $head.pos !== (dir > 0 ? selection.to : selection.from)) return null;
		const atEdge = byLine
			? view.endOfTextblock(dir > 0 ? "down" : "up")
			: $head.parentOffset === (dir > 0 ? $head.parent.content.size : 0);
		if (!atEdge) return null;
		at = edgeOf($head, dir);
		// Text follows text: the browser's own. So is a text beyond the blocks that are one thing: its own move goes over them into that text
		// in one press. Only with no text left that way does the browser stop, and the editor moves the end itself, a block at a time.
		if (at === null || !isWhole(dir > 0 ? doc.resolve(at).nodeAfter : doc.resolve(at).nodeBefore)) return null;
		if (Selection.findFrom(doc.resolve(at), dir, true)) return null;
	} else at = $head.pos;
	const $at = doc.resolve(at);
	const next = dir > 0 ? $at.nodeAfter : $at.nodeBefore;
	// The body's end: the range stays as it is (left to the browser, its selection would end in the text again).
	if (!next) return at;
	return restingPlace(doc, isWhole(next) ? at + dir * next.nodeSize : at, dir);
}

/**
 * Where a head that has come to a place between blocks rests: there, while a block that is one thing or the body's end is next; with a text
 * next, at that text's near end, which is the same place to the eye and one the browser's own keys go on from.
 */
function restingPlace(doc: Node, at: number, dir: 1 | -1): number {
	const $at = doc.resolve(at);
	const next = dir > 0 ? $at.nodeAfter : $at.nodeBefore;
	if (!next || isWhole(next)) return at;
	return Selection.findFrom($at, dir, true)?.head ?? at;
}

const key = new PluginKey("rangeOverBlocks");

export const RangeOverWholeBlocks = Extension.create({
	name: "montiRangeOverBlocks",
	addProseMirrorPlugins() {
		/**
		 * The range this plugin last made, while it is still the body's selection. The editor reads the browser's selection again after every
		 * change of it (a mouse that moves on, the mouse let go), and that reading ends in text: while this is held, it is the reading.
		 */
		let held: Selection | null = null;
		/** Lets go of the drag being followed, if there is one: its listeners leave the document. */
		let endDrag = () => {};
		const set = (view: EditorView, anchor: number, head: number) => {
			const next = RangeOverBlocks.at(view.state.doc, anchor, head);
			held = next instanceof RangeOverBlocks ? next : null;
			if (!view.state.selection.eq(next)) view.dispatch(view.state.tr.setSelection(next));
		};
		return [
			new Plugin({
				key,
				view: () => ({ destroy: () => endDrag() }),
				props: {
					handleKeyDown(view, event) {
						if (["Shift", "Meta", "Control", "Alt"].includes(event.key)) return false;
						held = null;
						if (!event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) return false;
						if (view.composing || event.isComposing) return false;
						const move = { ArrowDown: [1, true], ArrowRight: [1, false], ArrowUp: [-1, true], ArrowLeft: [-1, false] }[
							event.key
						] as [1 | -1, boolean] | undefined;
						if (!move) return false;
						const head = nextHead(view, move[0], move[1]);
						if (head === null) return false;
						set(view, view.state.selection.anchor, head);
						view.dispatch(view.state.tr.scrollIntoView());
						return true;
					},
					handleDOMEvents: {
						mousedown(view, event) {
							held = null;
							if (event.button !== 0 || event.shiftKey) return false;
							const root = view.dom.ownerDocument;
							// Where the drag begins: the place in a text under the press. Only a drag that starts in a text is this plugin's.
							const pressed = view.posAtCoords({ left: event.clientX, top: event.clientY });
							if (!pressed || !view.state.doc.resolve(pressed.pos).parent.inlineContent) return false;
							const anchor = pressed.pos;
							endDrag();
							const move = (moved: MouseEvent) => {
								// The button is up though no `mouseup` came (the press became a drag of the picked words, which ends in a drop): a
								// pointer that only moves picks nothing.
								if ((moved.buttons & 1) === 0 || view.isDestroyed) return end();
								const { doc } = view.state;
								// The body changed under the drag: this is no longer the place it began.
								if (anchor > doc.content.size || !doc.resolve(anchor).parent.inlineContent) return end();
								const found = view.posAtCoords({ left: moved.clientX, top: moved.clientY });
								const under = found && found.inside >= 0 ? doc.nodeAt(found.inside) : null;
								let head: number | null = null;
								if (found && isWhole(under)) {
									head = found.inside > anchor ? found.inside + under.nodeSize : found.inside;
								} else {
									// Past the body's last block or before its first, when that block is one thing: the range takes it.
									const box = view.dom.getBoundingClientRect();
									if (moved.clientY > box.bottom - 1 && isWhole(doc.lastChild)) head = doc.content.size;
									else if (moved.clientY < box.top + 1 && isWhole(doc.firstChild)) head = 0;
									else {
										const last = view.dom.lastElementChild?.getBoundingClientRect();
										const first = view.dom.firstElementChild?.getBoundingClientRect();
										if (last && moved.clientY > last.bottom && isWhole(doc.lastChild)) head = doc.content.size;
										else if (first && moved.clientY < first.top && isWhole(doc.firstChild)) head = 0;
									}
								}
								if (head === null || head === anchor) {
									// Over a text again: the browser's own selection is right from here.
									held = null;
									return;
								}
								set(view, anchor, restingPlace(doc, head, head > anchor ? 1 : -1));
							};
							const end = () => {
								root.removeEventListener("mousemove", move);
								root.removeEventListener("mouseup", end);
								endDrag = () => {};
							};
							endDrag = end;
							root.addEventListener("mousemove", move);
							root.addEventListener("mouseup", end);
							return false;
						},
						// The picked words are being dragged to another place: that is the browser's drag, not a selection being made.
						dragstart() {
							endDrag();
							return false;
						},
						blur() {
							held = null;
							return false;
						},
					},
					createSelectionBetween(view) {
						// Only while the body's selection is still that range: a change of the body or another selection ends the hold.
						return held && view.state.selection.eq(held) ? held : null;
					},
					decorations(state) {
						const { selection, doc } = state;
						if (selection.empty || selection instanceof NodeSelection) return null;
						const covered: Decoration[] = [];
						doc.nodesBetween(selection.from, selection.to, (node, pos) => {
							if (!isWhole(node)) return true;
							if (pos >= selection.from && pos + node.nodeSize <= selection.to)
								covered.push(Decoration.node(pos, pos + node.nodeSize, { "data-covered": "" }));
							return false;
						});
						return covered.length > 0 ? DecorationSet.create(doc, covered) : null;
					},
				},
			}),
		];
	},
});

/**
 * The selection a body opens with, when the one it was given picks a block (T193): a body that begins with a picture opened with that picture
 * picked and its tools up, before anything was pressed. Nothing is picked until the person picks it: the caret's first place in a text, or with
 * no text at all the gap before the first block.
 */
export function nothingPicked(doc: Node, gap: ($pos: ResolvedPos) => Selection): Selection {
	const $start = doc.resolve(0);
	return Selection.findFrom($start, 1, true) ?? gap($start);
}
