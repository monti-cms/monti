import { commands } from "vitest/browser";
import type {} from "./commands";

/** A point of the page, in client coordinates (what `getBoundingClientRect` gives). */
export type Point = { x: number; y: number };

/**
 * Moves the mouse through the points as a hand does, crossing everything between them (`testing/commands.ts`). Use it to reach whatever shows on hover:
 * start where the person starts (over the table, the block) and end on the thing to press.
 */
export const pointerPath = (points: Point[], options?: { steps?: number }) => commands.movePointer(points, options);

/** Types Hangul into the focused element through an input method, syllable by syllable (`testing/commands.ts`). */
export const typeKorean = (text: string, options?: { commit?: boolean }) => commands.typeKorean(text, options);

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

/**
 * What the browser's tooltip would say with the pointer at the middle of `element`: the `title` of what is on top there, or of what holds it. A `title` under
 * something that covers it (a row's link covers its row) is never said, and this is `null`.
 */
export function titleUnderPointer(element: Element): string | null {
	const box = element.getBoundingClientRect();
	const top = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
	return top?.closest("[title]")?.getAttribute("title") ?? null;
}
