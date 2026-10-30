import { describe, expect, it } from "vitest";
import { PARENT_ONLY_VIEW_CLASS } from "../../blocks/added/shared";
import { findBlockDOM, refineBlock } from "../block-resolve";

/** jsdom has no layout. Give each element under test a rect. */
const box = (element: Element | null, left: number, top: number, right: number, bottom: number) => {
	if (!element) throw new Error("No element");
	(element as HTMLElement).getBoundingClientRect = () => new DOMRect(left, top, right - left, bottom - top);
	return element as HTMLElement;
};

const html = (markup: string) => {
	const root = document.createElement("div");
	root.className = "ProseMirror";
	root.innerHTML = markup;
	document.body.replaceChildren(root);
	return root;
};

describe("one handle per line (refineBlock)", () => {
	it("a list's bullet area maps to the item at that height, or the inner item for an indented list", () => {
		const root = html("<ul><li><p>첫째</p></li><li><p>둘째</p><ul><li><p>안쪽</p></li></ul></li></ul>");
		const [outer, first, second, inner] = [
			root.querySelector("ul"),
			root.querySelectorAll("li")[0],
			root.querySelectorAll("li")[1],
			root.querySelectorAll("li")[2],
		];
		box(outer, 0, 0, 500, 90);
		box(first, 20, 0, 500, 30);
		box(second, 20, 30, 500, 90);
		box(second?.querySelector("ul") ?? null, 40, 60, 500, 90);
		box(inner, 60, 60, 500, 90);
		expect(refineBlock(outer as HTMLElement, 5, 10)).toBe(first);
		expect(refineBlock(outer as HTMLElement, 5, 40)).toBe(second);
		expect(refineBlock(outer as HTMLElement, 5, 70)).toBe(inner);
	});

	it("the gap between list items maps to the nearest item, not the whole list", () => {
		const root = html("<ul><li><p>첫째</p></li><li><p>둘째</p></li></ul>");
		const [first, second] = Array.from(root.querySelectorAll("li"));
		const list = box(root.querySelector("ul"), 0, 0, 500, 100);
		box(first ?? null, 20, 0, 500, 40);
		box(second ?? null, 20, 60, 500, 100);
		expect(refineBlock(list, 5, 45)).toBe(first);
		expect(refineBlock(list, 5, 56)).toBe(second);
	});

	it("a single column is not a target: column gaps and margins map to the paragraph at that height, and a line with no paragraph maps to the whole column split", () => {
		const root = html(
			'<div class="react-renderer node-cmsColumns"><div data-node-view-wrapper><div data-node-view-content><div data-node-view-content-react>' +
				`<div class="react-renderer node-cmsColumn ${PARENT_ONLY_VIEW_CLASS}"><div data-node-view-wrapper><div data-node-view-content><div data-node-view-content-react><p>왼쪽</p></div></div></div></div>` +
				`<div class="react-renderer node-cmsColumn ${PARENT_ONLY_VIEW_CLASS}"><div data-node-view-wrapper><div data-node-view-content><div data-node-view-content-react><p>오른쪽</p></div></div></div></div>` +
				"</div></div></div></div>",
		);
		const columns = root.querySelector<HTMLElement>(".node-cmsColumns");
		const [left, right] = Array.from(root.querySelectorAll<HTMLElement>(".node-cmsColumn"));
		box(columns, 0, 0, 500, 100);
		box(left ?? null, 0, 12, 240, 100);
		box(right ?? null, 260, 12, 500, 100);
		const leftText = box(left?.querySelector("p") ?? null, 8, 16, 232, 40);
		const rightText = box(right?.querySelector("p") ?? null, 268, 16, 492, 40);

		expect(refineBlock(columns as HTMLElement, 255, 20)).toBe(rightText);
		expect(refineBlock(columns as HTMLElement, 100, 20)).toBe(leftText);
		// Margin below a paragraph in a column: the whole column split, not a single column
		expect(refineBlock(left as HTMLElement, 100, 80)).toBe(columns);
		// Top margin (a line with no paragraph): the whole column split
		expect(refineBlock(columns as HTMLElement, 100, 5)).toBe(columns);
	});

	it("pointing inside a blockquote still targets the whole blockquote", () => {
		const root = html("<blockquote><p>인용</p><p>둘째</p></blockquote><p>뒤</p>");
		const quote = root.querySelector("blockquote");
		expect(findBlockDOM(root, root.querySelector("blockquote p"))).toBe(quote);
	});
});
