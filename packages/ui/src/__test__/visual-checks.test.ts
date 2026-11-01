import { describe, expect, it } from "vitest";
import {
	type BoxMeasures,
	type CenterMeasures,
	type CenterTextMeasure,
	type Drawn,
	findBoxProblems,
	findOffCenterText,
	findSplitIcons,
	findWrongMono,
	type IconMeasures,
	type MonoMeasures,
	type TextMeasure,
} from "../../visual/checks";

/**
 * The decisions of the visual checks, fed what a page would measure. `visual-checks.browser.test.ts` sees that the measuring reads a real page.
 * A box is written as its top and height (`line(16, 20)` spans 16 to 36), 100px wide unless said.
 */
const shown: Drawn = { display: "block", visibility: "visible", width: 100, height: 20 };
const line = (top: number, height: number, width = 50) => ({ top, bottom: top + height, width, height });
const named = (tag: string, text: string, classes: string[] = []) => ({ tag, text, classes });

describe("the icon check", () => {
	type Control = IconMeasures["controls"][number];
	const text = (
		lines: ReturnType<typeof line>[],
		words = "보기",
		enclosing: Drawn[] = [shown, shown],
	): TextMeasure => ({
		text: words,
		lines,
		enclosing,
	});
	const icon = (top: number, height = 14, plate = { width: 14, height }) => ({
		...shown,
		...line(top, height, 14),
		plate,
	});
	const control = (icons: Control["icons"], texts: TextMeasure[], tag = "button"): Control => ({
		...named(tag, texts.map((t) => t.text).join(" ")),
		...shown,
		icons,
		texts,
	});
	const find = (...controls: Control[]) => findSplitIcons({ controls });

	it("UI-T5 passes an icon that shares its line with the text", () => {
		expect(find(control([icon(3)], [text([line(0, 20)])]))).toEqual([]);
	});

	it("UI-T5 finds an icon that sits on a line above its text, and names the control", () => {
		const findings = find(control([icon(0)], [text([line(16, 20)])]));
		expect(findings).toEqual([{ check: "icon", detail: expect.stringContaining('<button> "보기"') }]);
		expect(findings[0]?.detail).toContain("(y 0-14) off the line of its text (y 16-36)");
	});

	it("UI-T5 passes an icon next to any line of wrapped text", () => {
		expect(find(control([icon(23)], [text([line(0, 20), line(20, 20)], "a long label")]))).toEqual([]);
	});

	it("UI-T5 finds an icon in a plate of its own size that sits off the line, and leaves a picture over a caption alone", () => {
		expect(find(control([icon(0, 14, { width: 14, height: 14 })], [text([line(16, 20)])]))).toHaveLength(1);
		expect(find(control([icon(50, 20, { width: 100, height: 120 })], [text([line(130, 20)], "안내서.pdf")]))).toEqual(
			[],
		);
	});

	it("UI-T5 ignores a screen-reader label, an icon alone and text alone", () => {
		const label = text([line(40, 20)], "Close", [{ ...shown, height: 1 }, shown]);
		expect(find(control([icon(3)], [label]), control([icon(3)], []), control([], [text([line(40, 20)])]))).toEqual([]);
	});

	it("UI-T5 ignores a control, an icon or a text that is not shown", () => {
		const off = { ...control([icon(0)], [text([line(16, 20)])]), display: "none" };
		expect(find(off)).toEqual([]);
		expect(find(control([{ ...icon(0), width: 0, height: 0 }], [text([line(16, 20)])]))).toEqual([]);
		expect(
			find(control([icon(0)], [text([line(16, 20)], "보기", [{ ...shown, visibility: "hidden" }, shown])])),
		).toEqual([]);
		// A blank text node and an empty line box are not text.
		expect(find(control([icon(0)], [text([line(16, 20)], "  "), text([line(16, 20, 0)])]))).toEqual([]);
	});
});

/** A font whose ascent is 13, whose Hangul sample reaches 11.4 above and 1.2 below the baseline, and whose cap height is 10 (nothing below). */
const INK = {
	hangul: { fontBoundingBoxAscent: 13, actualBoundingBoxAscent: 11.4, actualBoundingBoxDescent: 1.2 },
	latin: { fontBoundingBoxAscent: 13, actualBoundingBoxAscent: 10, actualBoundingBoxDescent: 0 },
};
const SANS = "'Monti Pretendard', sans-serif";
const MONO = "'Monti Plex Mono', monospace";

describe("the center check", () => {
	type Control = CenterMeasures["controls"][number];
	const node = (words: string, lines: ReturnType<typeof line>[], extra: Partial<CenterTextMeasure> = {}) => ({
		text: words,
		lines,
		enclosing: [shown, shown],
		inSvg: false,
		fontFamily: SANS,
		ink: INK,
		...extra,
	});
	/** A 36px control (0 to 36, no border) with one text on a 16px line at `top`. */
	const control = (words: string, top: number, extra: Partial<Control> = {}): Control => ({
		...named("button", words),
		...shown,
		display: "inline-flex",
		height: 36,
		top: 0,
		bottom: 36,
		borderTopWidth: "0px",
		borderBottomWidth: "0px",
		texts: [node(words, [line(top, 16)])],
		...extra,
	});
	const check = (...controls: Control[]) => findOffCenterText({ monoFont: MONO, controls });

	it("UI-T6 passes Hangul and Latin text whose ink is centered in a 36px box", () => {
		// Hangul: baseline 10+13=23, ink 11.6 to 24.2 -> center 17.9. Latin: ink 13 to 23 -> center 18.
		expect(check(control("저장", 10), control("Save", 10))).toEqual([]);
	});

	it("UI-T6 finds text that sits above the center, as a bottom-padding nudge leaves it", () => {
		const findings = check(control("저장", 8));
		expect(findings).toEqual([
			{ check: "center", detail: expect.stringContaining('<button> "저장" ink is 2.1px above the center') },
		]);
		expect(findings[0]?.detail).toContain("of its 36px box (9.6px above, 13.8px below)");
		expect(check(control("Save", 8))).toHaveLength(1);
	});

	it("UI-T6 finds text below the center, and tolerates less than 0.5px", () => {
		expect(check(control("Save", 12))[0]?.detail).toContain("2.0px below the center");
		expect(check(control("Save", 10.4))).toEqual([]);
		expect(check(control("Save", 10.6))).toHaveLength(1);
	});

	it("UI-T6 measures text in the mono face to 0.75px, and Hangul in it to a pixel", () => {
		const mono = (words: string, top: number, fontFamily: string) =>
			control(words, top, { texts: [node(words, [line(top, 16)], { fontFamily })] });
		// Latin 0.6px off: past 0.5, within 0.75.
		expect(check(mono("Save", 10.6, MONO))).toEqual([]);
		expect(check(mono("Save", 10.8, MONO))).toHaveLength(1);
		// Hangul 0.9px above the center: past 0.75, within 1, since the system's Hangul face is not the page's to measure.
		expect(check(mono("뉴스", 9.2, MONO))).toEqual([]);
		expect(check(mono("뉴스", 9.2, SANS))).toHaveLength(1);
		expect(check(mono("뉴스", 8.8, MONO))).toHaveLength(1);
	});

	it("UI-T6 measures inside the borders, and leaves out an underlined tab", () => {
		// A 2px border on all sides: the padding box is 2..36, its center 19, and the ink (cap height 10 on a baseline of 24) is centered on 19.
		const bordered = (top: number, borderTopWidth: string, borderBottomWidth: string) =>
			control("Save", top, { height: 38, bottom: 38, borderTopWidth, borderBottomWidth });
		expect(check(bordered(11, "2px", "2px"))).toEqual([]);
		expect(check(bordered(9, "2px", "2px"))).toHaveLength(1);
		// The same line under an underline only is not measured, whatever its place.
		expect(check(bordered(2, "0px", "3px"))).toEqual([]);
	});

	it("UI-T6 leaves out what is not a fixed-height single line", () => {
		expect(check(control("Save", 4, { display: "inline" }))).toEqual([]);
		expect(check(control("Save", 4, { height: 200, bottom: 200 }))).toEqual([]);
		// Less than 6px of room around the line: a text button.
		expect(check(control("Save", 0, { height: 20, bottom: 20 }))).toEqual([]);
		expect(check(control("Save", 4, { texts: [node("Save", [line(4, 16), line(24, 16)])] }))).toEqual([]);
		const stacked = control("Title", 4, { texts: [node("Title", [line(4, 16)]), node("Caption", [line(28, 16)])] });
		expect(check(stacked)).toEqual([]);
		// Digits and symbols have neither reference text.
		expect(check(control("12", 4))).toEqual([]);
	});

	it("UI-T6 ignores a control that is not shown, and text that is hidden or drawn in an svg", () => {
		expect(check(control("Save", 4, { width: 0, height: 0 }))).toEqual([]);
		expect(
			check(
				control("Save", 4, { texts: [node("Save", [line(4, 16)], { enclosing: [{ ...shown, height: 1 }, shown] })] }),
			),
		).toEqual([]);
		expect(check(control("Save", 4, { texts: [node("Save", [line(4, 16)], { inSvg: true })] }))).toEqual([]);
	});
});

describe("the mono check", () => {
	type Element = MonoMeasures["elements"][number];
	const el = (classes: string, fontFamily: string, extra: Partial<Element> = {}): Element => ({
		...named("span", "주소", classes.split(" ")),
		...shown,
		fontFamily,
		...extra,
	});
	const check = (...elements: Element[]) => findWrongMono({ monoFont: MONO, elements });

	it("UI-T7 passes an element that computes to the mono face", () => {
		expect(check(el("font-mono", MONO), el("text-monti-meta", MONO), el("text-monti-body", SANS))).toEqual([]);
	});

	it("UI-T7 finds a font-mono element that computes sans, as a type role of its own family left it", () => {
		expect(check(el("text-monti-body font-mono", SANS))).toEqual([
			{
				check: "mono",
				detail: '<span.text-monti-body.font-mono> "주소" asks for Monti Plex Mono but computes Monti Pretendard',
			},
		]);
	});

	it("UI-T7 finds a sans role that computes mono, as a mono parent's face reaching its text once did", () => {
		expect(check(el("text-monti-body", MONO))).toEqual([
			{ check: "mono", detail: '<span.text-monti-body> "주소" has a sans role but computes Monti Plex Mono' },
		]);
		// With `font-mono` on the same element the mono face is what it asked for.
		expect(check(el("text-monti-body font-mono", MONO))).toEqual([]);
	});

	it("UI-T7 finds a mono role that computes sans, and leaves out an element that is not shown or asks only behind a variant", () => {
		expect(check(el("text-monti-micro", SANS))).toHaveLength(1);
		expect(check(el("md:font-mono", SANS), el("data-[x]:text-monti-meta", SANS))).toEqual([]);
		expect(check(el("font-mono", SANS, { display: "none" }), el("font-mono", SANS, { width: 1 }))).toEqual([]);
	});

	it("UI-T7 checks nothing on a page without the admin's mono token", () => {
		expect(findWrongMono({ monoFont: "", elements: [el("font-mono", SANS)] })).toEqual([]);
	});
});

describe("the box checks", () => {
	const measures = (extra: Partial<BoxMeasures>): BoxMeasures => ({
		page: { scrollWidth: 1440, clientWidth: 1440 },
		cutting: [],
		typed: [],
		roleSizes: {},
		...extra,
	});

	it("UI-T8 finds a page that scrolls sideways", () => {
		expect(findBoxProblems(measures({}))).toEqual([]);
		expect(findBoxProblems(measures({ page: { scrollWidth: 1500, clientWidth: 1440 } }))).toEqual([
			{ check: "overflow", detail: "page is 1500px wide in a 1440px window" },
		]);
	});

	describe("clipped text", () => {
		type Cut = BoxMeasures["cutting"][number];
		/** A 100x20 box with text that is 200px wide, cut sideways. */
		const cut = (extra: Partial<Cut> = {}): Cut => ({
			...named("div", "a long name", ["truncate-not"]),
			...shown,
			overflowX: "hidden",
			overflowY: "visible",
			textOverflow: "clip",
			lineClamp: "none",
			scrollWidth: 200,
			scrollHeight: 20,
			clientWidth: 100,
			clientHeight: 20,
			...extra,
		});
		const check = (...cutting: Cut[]) => findBoxProblems(measures({ cutting }));

		it("UI-T8 finds text an element cuts, sideways or down", () => {
			expect(check(cut())).toEqual([
				{ check: "clipped", detail: '<div.truncate-not> "a long name" content 200x20 in a 100x20 box' },
			]);
			expect(check(cut({ overflowX: "clip" }))).toHaveLength(1);
			expect(
				check(cut({ overflowX: "visible", overflowY: "hidden", scrollWidth: 100, scrollHeight: 60 })),
			).toHaveLength(1);
		});

		it("UI-T8 passes a cut that is meant, a box that scrolls, and content within a pixel of the room", () => {
			expect(check(cut({ textOverflow: "ellipsis" }), cut({ lineClamp: "2" }))).toEqual([]);
			expect(check(cut({ overflowX: "auto" }), cut({ overflowX: "scroll" }))).toEqual([]);
			expect(check(cut({ scrollWidth: 101 }))).toEqual([]);
			// Cut sideways only: more content down is not cut.
			expect(check(cut({ scrollWidth: 100, scrollHeight: 60 }))).toEqual([]);
		});

		it("UI-T8 passes a screen-reader label, an element that is not shown, and one with no text", () => {
			expect(
				check(cut({ width: 1, height: 1 }), cut({ display: "none" }), cut({ visibility: "hidden" }), cut({ text: "" })),
			).toEqual([]);
		});
	});

	describe("type sizes", () => {
		type Typed = BoxMeasures["typed"][number];
		const typed = (classes: string, fontSize: string, inherited: string[] = []): Typed => ({
			...named("p", "본문", classes.split(" ")),
			fontSize,
			inherited,
		});
		const check = (...elements: Typed[]) =>
			findBoxProblems(measures({ typed: elements, roleSizes: { body: "14px", note: "12px", muted: null } }));

		it("UI-T8 finds an element whose size is not its type role's", () => {
			expect(check(typed("text-monti-body", "14px"), typed("text-monti-note", "12px"))).toEqual([]);
			expect(check(typed("text-monti-body text-monti-muted", "16px"))).toEqual([
				{
					check: "type",
					detail:
						'<p.text-monti-body.text-monti-muted> "본문" is text-monti-body but computes font size 16px (token 14px)',
				},
			]);
		});

		it("UI-T8 passes a color class, a role behind a variant, and a role a parent sets for its children", () => {
			expect(check(typed("text-monti-muted", "16px"))).toEqual([]);
			expect(check(typed("text-monti-body md:text-monti-note", "12px"))).toEqual([]);
			expect(
				check(
					typed("text-monti-body", "12px", ["[&_p]:text-monti-note"]),
					typed("text-monti-body", "12px", ["*:text-monti-note"]),
				),
			).toEqual([]);
			// A parent's own role behind a variant sets nothing for its children.
			expect(check(typed("text-monti-body", "12px", ["md:text-monti-note"]))).toHaveLength(1);
		});
	});
});
