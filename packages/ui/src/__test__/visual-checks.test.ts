// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { findOffCenterText, findSplitIcons, findWrongMono } from "../../visual/checks";

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
	it("UI-T5 passes an icon that shares its line with the text of a button, a link and a tab", () => {
		const control = (tag: string, attrs = "") =>
			`<${tag} ${attrs} data-box="0,20"><svg data-box="3,14"></svg><span data-box="0,20" data-lines="0,20">보기</span></${tag}>`;
		expect(find(control("button") + control("a", 'href="#"') + control("div", 'role="tab"'))).toEqual([]);
	});

	it("UI-T5 finds an icon that sits on a line above its text", () => {
		const findings = find(
			`<button class="inline" data-box="0,36"><svg data-box="0,14"></svg><span data-box="14,20" data-lines="16,20">보기</span></button>`,
		);
		expect(findings).toHaveLength(1);
		expect(findings[0]?.check).toBe("icon");
		expect(findings[0]?.detail).toContain('"보기"');
	});

	it("UI-T5 passes an icon next to any line of wrapped text", () => {
		expect(
			find(
				`<button data-box="0,40"><svg data-box="3,14"></svg><span data-box="0,40" data-lines="0,20;20,20">a long label</span></button>`,
			),
		).toEqual([]);
	});

	it("UI-T5 finds an icon in a plate of its own size that sits off the line, and leaves a picture over a caption alone", () => {
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

	it("UI-T5 ignores a screen-reader label, an icon alone and text alone", () => {
		expect(
			find(
				`<button data-box="0,20"><svg data-box="3,14"></svg><span data-box="0,1" data-lines="40,20">Close</span></button>` +
					`<button data-box="0,20"><svg data-box="3,14"></svg></button>` +
					`<button data-box="0,20"><span data-box="0,20" data-lines="40,20">Text</span></button>`,
			),
		).toEqual([]);
	});

	it("UI-T5 ignores a control that is not shown", () => {
		expect(
			find(`<button><svg data-box="0,14"></svg><span data-box="14,20" data-lines="16,20">보기</span></button>`),
		).toEqual([]);
	});
});

/**
 * The center check reads a canvas, which jsdom lacks: a test draws one whose font has an ascent of 13 and a descent of 3, whose Hangul sample
 * reaches 11.4 above and 1.2 below the baseline, and whose cap height is 10 (nothing below).
 */
describe("the center check", () => {
	beforeEach(() => {
		vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation((() => ({
			font: "",
			measureText: (text: string) => {
				const hangul = /[가-힣]/.test(text);
				return {
					fontBoundingBoxAscent: 13,
					fontBoundingBoxDescent: 3,
					actualBoundingBoxAscent: hangul ? 11.4 : 10,
					actualBoundingBoxDescent: hangul ? 1.2 : 0,
				};
			},
		})) as unknown as HTMLCanvasElement["getContext"]);
	});
	afterEach(() => document.documentElement.style.removeProperty("--monti-font-mono"));

	const control = (box: string, text: string, top: number, tag = "button") =>
		`<${tag} ${tag === "a" ? 'href="#"' : ""} style="display:inline-flex" data-box="${box}"><span data-box="${box}" data-lines="${top},16">${text}</span></${tag}>`;
	const check = (html: string) => {
		document.body.innerHTML = html;
		return findOffCenterText();
	};

	it("UI-T6 passes Hangul and Latin text whose ink is centered in a 36px box", () => {
		// Hangul: baseline 10+13=23, ink 11.6 to 24.2 -> center 17.9. Latin: ink 13 to 23 -> center 18.
		expect(check(control("0,36", "저장", 10) + control("0,36", "Save", 10, "a"))).toEqual([]);
	});

	it("UI-T6 finds text that sits about a pixel above the center, as a bottom-padding nudge leaves it", () => {
		const findings = check(control("0,36", "저장", 8));
		expect(findings).toHaveLength(1);
		expect(findings[0]?.check).toBe("center");
		expect(findings[0]?.detail).toContain("above the center");
		expect(findings[0]?.detail).toContain('"저장"');
		expect(check(control("0,36", "Save", 8))).toHaveLength(1);
	});

	it("UI-T6 finds text below the center, and tolerates less than 0.5px", () => {
		expect(check(control("0,36", "Save", 12))[0]?.detail).toContain("below the center");
		expect(check(control("0,36", "Save", 10.4))).toEqual([]);
		expect(check(control("0,36", "Save", 10.6))).toHaveLength(1);
		expect(check(control("0,36", "Save", 11))).toHaveLength(1);
	});

	it("UI-T6 measures Hangul in the mono face to a pixel, since the system's Hangul face is not the page's to measure", () => {
		const hangul = (family: string) =>
			`<button style="display:inline-flex;font-family:${family}" data-box="0,36"><span style="font-family:${family}" data-box="0,36" data-lines="9.2,16">뉴스</span></button>`;
		document.documentElement.style.setProperty("--monti-font-mono", "'Monti Plex Mono', monospace");
		// 0.9px above the center: more than 0.75 (the mono face's own tolerance), within 1.
		expect(check(hangul("'Monti Plex Mono', monospace"))).toEqual([]);
		expect(check(hangul("'Monti Pretendard', sans-serif"))).toHaveLength(1);
	});

	it("UI-T6 measures inside the borders, and leaves out an underlined tab", () => {
		const bordered = (style: string, box: string) =>
			`<button style="display:inline-flex;${style}" data-box="${box}"><span data-box="${box}" data-lines="11,16">Save</span></button>`;
		// A 2px border on all sides: the padding box is 2..36, its center 19, and the ink (cap height 10 on a baseline of 24) is centered on 19.
		expect(check(bordered("border:2px solid", "0,38"))).toEqual([]);
		expect(check(bordered("border:2px solid", "0,38").replace('data-lines="11,16"', 'data-lines="9,16"'))).toHaveLength(
			1,
		);
		// The same line under an underline only is not measured, whatever its place.
		expect(
			check(bordered("border-bottom:3px solid", "0,39").replace('data-lines="11,16"', 'data-lines="2,16"')),
		).toEqual([]);
	});

	it("UI-T6 leaves out what is not a fixed-height single line", () => {
		const high = control("0,36", "Save", 4);
		expect(check(high.replace("display:inline-flex", "display:inline"))).toEqual([]);
		expect(check(control("0,200", "Save", 4))).toEqual([]);
		expect(check(control("0,20", "Save", 0))).toEqual([]);
		const two = `<button style="display:inline-flex" data-box="0,60"><span data-box="0,60" data-lines="4,16;24,16">Save</span></button>`;
		expect(check(two)).toEqual([]);
		const stacked = `<div role="menuitem" style="display:flex" data-box="0,50"><span data-box="0,16" data-lines="4,16">Title</span><span data-box="0,16" data-lines="28,16">Caption</span></div>`;
		expect(check(stacked)).toEqual([]);
		expect(check(control("0,36", "12", 4))).toEqual([]);
	});

	it("UI-T6 ignores a control that is not shown or whose text is hidden", () => {
		expect(check('<button style="display:inline-flex"><span data-lines="4,16">Save</span></button>')).toEqual([]);
		expect(
			check(
				`<button style="display:inline-flex" data-box="0,36"><span data-box="0,1" data-lines="4,16">Save</span></button>`,
			),
		).toEqual([]);
	});

	it("UI-T6 looks at menu rows, tabs, chips and status bar cells", () => {
		const row = (attrs: string) =>
			`<div ${attrs} style="display:flex" data-box="0,36"><span data-box="0,36" data-lines="8,16">Save</span></div>`;
		for (const attrs of [
			'role="menuitem"',
			'role="tab"',
			'role="option"',
			'data-slot="chip"',
			'data-slot="status-bar-cell"',
		])
			expect(check(row(attrs)), attrs).toHaveLength(1);
		expect(check(row('class="not-a-control"'))).toEqual([]);
	});
});

describe("the mono check", () => {
	const SANS = "'Monti Pretendard', sans-serif";
	const MONO = "'Monti Plex Mono', monospace";
	const check = (html: string) => {
		document.documentElement.style.setProperty("--monti-font-mono", MONO);
		document.body.innerHTML = html;
		return findWrongMono();
	};
	afterEach(() => document.documentElement.style.removeProperty("--monti-font-mono"));
	// jsdom lays nothing out: every element has a box.
	beforeEach(() => {
		vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({ width: 40, height: 16 } as DOMRect);
	});

	it("UI-T7 passes an element that computes to the mono face", () => {
		expect(
			check(
				`<input class="font-mono" style="font-family:${MONO}"><span class="text-monti-meta" style="font-family:${MONO}">/posts</span>`,
			),
		).toEqual([]);
	});

	it("UI-T7 finds a font-mono element that computes sans, as a type role of its own family left it", () => {
		const findings = check(`<input class="text-monti-body font-mono" style="font-family:${SANS}">`);
		expect(findings).toHaveLength(1);
		expect(findings[0]?.check).toBe("mono");
		expect(findings[0]?.detail).toContain("Monti Plex Mono");
		expect(findings[0]?.detail).toContain("Monti Pretendard");
	});

	it("UI-T7 finds a sans role that computes mono, as a mono parent's face reaching its text once did", () => {
		const findings = check(`<span class="text-monti-body" style="font-family:${MONO}">라벨</span>`);
		expect(findings).toHaveLength(1);
		expect(findings[0]?.detail).toContain("has a sans role");
		// With `font-mono` on the same element the mono face is what it asked for.
		expect(check(`<span class="text-monti-body font-mono" style="font-family:${MONO}">주소</span>`)).toEqual([]);
	});

	it("UI-T7 finds a mono role that computes sans, and leaves out an element that is not shown or asks only behind a variant", () => {
		expect(check(`<span class="text-monti-micro" style="font-family:${SANS}">라벨</span>`)).toHaveLength(1);
		expect(check(`<span class="md:font-mono" style="font-family:${SANS}">주소</span>`)).toEqual([]);
		expect(check(`<span class="font-mono" style="display:none;font-family:${SANS}">주소</span>`)).toEqual([]);
	});
});
