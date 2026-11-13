import { commands, page, userEvent } from "vitest/browser";
import type {} from "./commands";

/** A point of the page, in client coordinates (what `getBoundingClientRect` gives). */
export type Point = { x: number; y: number };

/**
 * Moves the mouse through the points as a hand does, crossing everything between them (`testing/commands.ts`). Use it to reach whatever shows on hover:
 * start where the person starts (over the table, the block) and end on the thing to press.
 */
export const pointerPath = (points: Point[], options?: { steps?: number }) => commands.movePointer(points, options);

/**
 * Holds the mouse at the first point, moves through the others and lets go at the last: a drag (`testing/commands.ts`). With `hold` the mouse stays
 * down, to look at the middle of the drag; `dropDrag` lets go.
 */
export const dragPath = (points: Point[], options?: { steps?: number; hold?: boolean }) =>
	commands.dragPointer(points, options);

/** Lets go of a drag that `dragPath` holds. */
export const dropDrag = () => commands.dropPointer();

/** The middle of an element, as a point of the page. */
export function middleOf(element: Element): Point {
	const box = element.getBoundingClientRect();
	return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
}

/** Where `words` are drawn inside `root`. They may run over several pieces of one block (a bold part and a plain part). */
function wordsRange(root: Element, words: string): Range {
	const pieces: Text[] = [];
	const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
	for (let node = walker.nextNode(); node; node = walker.nextNode()) pieces.push(node as Text);
	const blockOf = (piece: Text) => piece.parentElement?.closest("p, li, h1, h2, h3, h4, td, th") ?? root;
	for (const block of new Set(pieces.map(blockOf))) {
		const inBlock = pieces.filter((piece) => blockOf(piece) === block);
		const at = inBlock
			.map((piece) => piece.data)
			.join("")
			.indexOf(words);
		if (at < 0) continue;
		const find = (offset: number): [Text, number] => {
			let left = offset;
			for (const piece of inBlock) {
				if (left <= piece.data.length) return [piece, left];
				left -= piece.data.length;
			}
			throw new Error("past the block");
		};
		const range = document.createRange();
		range.setStart(...find(at));
		range.setEnd(...find(at + words.length));
		return range;
	}
	throw new Error(`no text "${words}"`);
}

/** A press at a point of the page, on whatever is there. */
async function pressAt(root: Element, point: Point, shift = false) {
	const box = root.getBoundingClientRect();
	await userEvent.click(page.elementLocator(root), {
		position: { x: point.x - box.left, y: point.y - box.top },
		...(shift ? { modifiers: ["Shift"] } : {}),
	});
}

/** Presses where `words` end inside `root`, as a person puts the caret after them. */
export async function caretAfter(root: Element, words: string) {
	const glyphs = [...wordsRange(root, words).getClientRects()];
	const last = glyphs[glyphs.length - 1];
	if (!last) throw new Error(`"${words}" is not drawn`);
	await pressAt(root, { x: last.right - 1, y: last.top + last.height / 2 });
}

/** Picks `words` inside `root` as a person does: a press where they start, and a press with Shift where they end. */
export async function pickWords(root: Element, words: string) {
	const glyphs = [...wordsRange(root, words).getClientRects()];
	const [first, last] = [glyphs[0], glyphs[glyphs.length - 1]];
	if (!first || !last) throw new Error(`"${words}" is not drawn`);
	await pressAt(root, { x: first.left + 1, y: first.top + first.height / 2 });
	await pressAt(root, { x: last.right - 1, y: last.top + last.height / 2 }, true);
}

/** Types Hangul into the focused element through an input method, syllable by syllable (`testing/commands.ts`). */
export const typeKorean = (text: string, options?: { commit?: boolean }) => commands.typeKorean(text, options);

/**
 * Presses the middle of `element` with the mouse, and again `gap` milliseconds later on whatever is there by then: a second press that comes
 * while the first one's doing is still on the screen (a window fading out).
 */
export const pressTwice = (element: Element, gap: number) => commands.pressTwice(middleOf(element), gap);

/** Presses `key`, and again `gap` milliseconds later, into whatever holds the focus by then. */
export const keyTwice = (key: string, gap: number) => commands.keyTwice(key, gap);

/** Holds `key` down as a hand does: one press and then `repeats` repeats, `every` milliseconds apart. `releaseKey` lets it go. */
export const holdKey = (key: string, options: { repeats: number; every: number }) => commands.holdKey(key, options);

/** Lets go of a key that `holdKey` holds. */
export const releaseKey = (key: string) => commands.releaseKey(key);

/**
 * The boxes from `element` up to the page that scroll sideways: each one that clips or scrolls what is in it (overflow other than visible) and holds
 * more than its width, and the page itself. Empty when everything fits. Use it after anything that makes something wider.
 */
export function scrollsSideways(element: Element): string[] {
	const found: string[] = [];
	for (let box: Element | null = element; box; box = box.parentElement) {
		const { overflowX } = getComputedStyle(box);
		if (overflowX !== "visible" && box.scrollWidth > box.clientWidth + 1)
			found.push(`<${box.tagName.toLowerCase()}> ${box.scrollWidth} > ${box.clientWidth}`);
	}
	const page = document.documentElement;
	if (page.scrollWidth > page.clientWidth + 1) found.push(`the page ${page.scrollWidth} > ${page.clientWidth}`);
	return found;
}

/**
 * The cells of a table whose words run over the next column: wider than the cell and not clipped by it. Empty when every cell keeps its words inside. Use it
 * after columns are dragged narrow (docs/design/admin/components/list.md, every table's columns).
 */
export function spillingCells(table: Element): string[] {
	return [...table.querySelectorAll("tbody td")]
		.filter((cell) => cell.scrollWidth > cell.clientWidth + 1 && getComputedStyle(cell).overflowX === "visible")
		.map((cell) => `"${cell.textContent}" ${cell.scrollWidth} > ${cell.clientWidth}`);
}

/** What is on top at the middle of `element`: what a pointer there finds, which is not the element when something covers it. */
export function onTopOf(element: Element): Element | null {
	const box = element.getBoundingClientRect();
	return document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
}

/**
 * What a pointer at the middle of `element` would be told while the words there are cut: what the box of cut words (`CutWords`) on top there, or
 * around what is on top, says whole. Words under something that covers them (a row's link covers its row) are never said, and this is `null`.
 */
export function wholeUnderPointer(element: Element): string | null {
	const box = onTopOf(element)?.closest("[data-cut-words]");
	return box ? box.getAttribute("data-cut-words") || box.textContent : null;
}

/** The heights of a table's body rows that hold something, each once: one height when every row is as tall as the others. */
export function rowHeights(table: Element): number[] {
	const heights = [...table.querySelectorAll("tbody tr")].map((row) => row.getBoundingClientRect().height);
	return [...new Set(heights.filter((height) => height > 0))];
}
