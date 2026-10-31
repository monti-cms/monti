import { within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PARENT_ONLY_VIEW_CLASS } from "../../blocks/added/shared";
import { findBlockDOM, refineBlock } from "../block-resolve";

const html = (markup: string) => {
	const root = document.createElement("div");
	root.className = "ProseMirror";
	root.style.width = "500px";
	root.innerHTML = markup;
	document.body.replaceChildren(root);
	return root;
};

const rectOf = (element: Element | null | undefined) => {
	if (!element) throw new Error("No element");
	return element.getBoundingClientRect();
};

/** The vertical middle of an element: a line that lies inside it. */
const lineOf = (element: Element | null | undefined) => {
	const rect = rectOf(element);
	return rect.top + rect.height / 2;
};

describe("one handle per line (refineBlock)", () => {
	it("EDIT-D3 a list's bullet area maps to the item at that height, or the inner item for an indented list", () => {
		const secondWord = "둘째";
		const root = html(`<ul><li><p>첫째</p></li><li><p>${secondWord}</p><ul><li><p>안쪽</p></li></ul></li></ul>`);
		const [outer, nested] = within(root).getAllByRole("list");
		const [first, second, inner] = within(root).getAllByRole("listitem");
		if (!outer || !nested || !second) throw new Error("No list");
		// Left of the items, where the bullets are drawn.
		const bullets = rectOf(outer).left + 5;
		expect(refineBlock(outer, bullets, lineOf(first))).toBe(first);
		expect(refineBlock(outer, bullets, lineOf(within(second).getByText(secondWord)))).toBe(second);
		expect(refineBlock(outer, bullets, lineOf(inner))).toBe(inner);
	});

	it("EDIT-D3 a single column is not a target: column gaps and margins map to the paragraph at that height, and a line with no paragraph maps to the whole column split", () => {
		const [leftWord, rightWord] = ["왼쪽", "오른쪽"];
		// Two columns side by side under a top margin, each taller than its paragraph.
		const column = (word: string) =>
			`<div class="react-renderer node-cmsColumn ${PARENT_ONLY_VIEW_CLASS}" style="padding: 4px 8px 60px"><div data-node-view-wrapper><div data-node-view-content><div data-node-view-content-react><p style="margin: 0">${word}</p></div></div></div></div>`;
		const root = html(
			'<div class="react-renderer node-cmsColumns"><div data-node-view-wrapper><div data-node-view-content>' +
				'<div data-node-view-content-react style="display: grid; grid-template-columns: 1fr 1fr; column-gap: 20px; padding-top: 12px">' +
				column(leftWord) +
				column(rightWord) +
				"</div></div></div></div>",
		);
		const columns = root.querySelector<HTMLElement>(".node-cmsColumns");
		const [left, right] = Array.from(root.querySelectorAll<HTMLElement>(".node-cmsColumn"));
		if (!columns || !left) throw new Error("No columns");
		const leftText = within(root).getByText(leftWord);
		const rightText = within(root).getByText(rightWord);
		const textLine = lineOf(leftText);

		// In the gap between the columns, nearer the right one
		const gap = (rectOf(left).right + rectOf(right).left) / 2;
		expect(refineBlock(columns, gap + 5, textLine)).toBe(rightText);
		expect(refineBlock(columns, rectOf(leftText).left + 10, textLine)).toBe(leftText);
		// Margin below a paragraph in a column: the whole column split, not a single column
		expect(refineBlock(left, rectOf(leftText).left + 10, rectOf(left).bottom - 10)).toBe(columns);
		// Top margin (a line with no paragraph): the whole column split
		expect(refineBlock(columns, rectOf(leftText).left + 10, rectOf(columns).top + 5)).toBe(columns);
	});

	it("EDIT-D3 pointing inside a blockquote still targets the whole blockquote", () => {
		const quoted = "인용";
		// A list item would otherwise be a target of its own.
		const root = html(`<blockquote><p>앞</p><ul><li><p>${quoted}</p></li></ul></blockquote><p>뒤</p>`);
		expect(findBlockDOM(root, within(root).getByText(quoted))).toBe(within(root).getByRole("blockquote"));
	});
});
