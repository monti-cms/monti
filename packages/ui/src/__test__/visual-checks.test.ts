import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { findSplitIcons } from "../../visual/checks";

/**
 * jsdom lays nothing out, so a test says where things are: an element's box is its `data-box` (`top,height` of a 100px-wide box; none means
 * 0x0, not shown) and the lines of a text are the `data-lines` of its parent (`top,height` pairs, one per line).
 */
const box = (el: Element): DOMRect => {
	const [top = 0, height = 0] = (el.getAttribute("data-box") ?? "").split(",").map(Number);
	const width = el.hasAttribute("data-box") ? 100 : 0;
	return { top, bottom: top + height, left: 0, right: width, width, height, x: 0, y: top, toJSON: () => ({}) };
};

beforeEach(() => {
	vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
		return box(this);
	});
	vi.spyOn(Range.prototype, "getClientRects").mockImplementation(function (this: Range) {
		const parent = this.startContainer.parentElement;
		const pairs = (parent?.getAttribute("data-lines") ?? "").split(";").filter(Boolean);
		return pairs.map((pair) => {
			const [top = 0, height = 0] = pair.split(",").map(Number);
			return { top, bottom: top + height, left: 0, right: 50, width: 50, height, x: 0, y: top, toJSON: () => ({}) };
		}) as unknown as DOMRectList;
	});
});

afterEach(() => {
	vi.restoreAllMocks();
	document.body.innerHTML = "";
});

const find = (html: string) => {
	document.body.innerHTML = html;
	return findSplitIcons();
};

describe("the icon check", () => {
	it("passes an icon that shares its line with the text of a button, a link and a tab", () => {
		const control = (tag: string, attrs = "") =>
			`<${tag} ${attrs} data-box="0,20"><svg data-box="3,14"></svg><span data-box="0,20" data-lines="0,20">보기</span></${tag}>`;
		expect(find(control("button") + control("a", 'href="#"') + control("div", 'role="tab"'))).toEqual([]);
	});

	it("finds an icon that sits on a line above its text", () => {
		const findings = find(
			`<button class="inline" data-box="0,36"><svg data-box="0,14"></svg><span data-box="14,20" data-lines="16,20">보기</span></button>`,
		);
		expect(findings).toHaveLength(1);
		expect(findings[0]?.check).toBe("icon");
		expect(findings[0]?.detail).toContain('"보기"');
	});

	it("passes an icon next to any line of wrapped text", () => {
		expect(
			find(
				`<button data-box="0,40"><svg data-box="3,14"></svg><span data-box="0,40" data-lines="0,20;20,20">a long label</span></button>`,
			),
		).toEqual([]);
	});

	it("finds an icon in a plate of its own size that sits off the line, and leaves a picture over a caption alone", () => {
		expect(
			find(
				`<button data-box="0,36"><span data-box="0,14"><svg data-box="0,14"></svg></span><span data-box="14,20" data-lines="16,20">보기</span></button>`,
			),
		).toHaveLength(1);
		expect(
			find(
				`<button data-box="0,160"><div data-box="0,120"><svg data-box="50,20"></svg></div><span data-box="130,20" data-lines="130,20">안내서.pdf</span></button>`,
			),
		).toEqual([]);
	});

	it("ignores a screen-reader label, an icon alone and text alone", () => {
		expect(
			find(
				`<button data-box="0,20"><svg data-box="3,14"></svg><span data-box="0,1" data-lines="40,20">Close</span></button>` +
					`<button data-box="0,20"><svg data-box="3,14"></svg></button>` +
					`<button data-box="0,20"><span data-box="0,20" data-lines="40,20">Text</span></button>`,
			),
		).toEqual([]);
	});

	it("ignores a control that is not shown", () => {
		expect(
			find(`<button><svg data-box="0,14"></svg><span data-box="14,20" data-lines="16,20">보기</span></button>`),
		).toEqual([]);
	});
});
