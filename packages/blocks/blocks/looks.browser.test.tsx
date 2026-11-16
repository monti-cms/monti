import type { Block, Doc } from "@monti-cms/core";
import { renderDocument } from "@monti-cms/core/render";
import "@monti-cms/core/render.css";
import { createElement, type ElementType, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { blocks, marks } from "./index";
import { contrastOf, type Rgb } from "./mermaid/look";

// The blocks' looks as a reader sees them (doc 18): the site's drawing in a real browser, measured, in light and in dark.

const doc = (...list: Block[]): Doc => ({ type: "doc", blocks: list });
const p = (id: string, text: string): Block => ({ id, type: "paragraph", content: [{ type: "text", text }] });
const h = (type: unknown, props: Record<string, unknown> | null, ...children: unknown[]) =>
	createElement(type as ElementType, props, ...(children as ReactNode[]));

/** The two looks of a page: the text colour and the ground a site gives each. */
const PAGES = {
	light: { ink: "rgb(28 27 24)", ground: "rgb(250 249 245)" },
	dark: { ink: "rgb(236 235 230)", ground: "rgb(26 25 23)" },
} as const;
type Mode = keyof typeof PAGES;

let host: HTMLElement | null = null;
let root: Root | null = null;
afterEach(() => {
	root?.unmount();
	host?.remove();
	host = null;
	root = null;
	document.documentElement.classList.remove("dark");
	document.documentElement.style.cssText = "";
});

/** The page's body drawn the way a site draws it, in a box `width` wide, in the light or the dark look. */
function draw(body: Doc, { width = 640, mode = "light" }: { width?: number; mode?: Mode } = {}): HTMLElement {
	if (mode === "dark") document.documentElement.classList.add("dark");
	host = document.createElement("div");
	host.style.cssText = `width:${width}px;font:17px/1.6 system-ui, sans-serif;color:${PAGES[mode].ink};background:${PAGES[mode].ground};--monti-block-ground:${PAGES[mode].ground};`;
	document.body.append(host);
	root = createRoot(host);
	flushSync(() =>
		root?.render(
			createElement("div", null, ...renderDocument(body, { createElement: h, blocks, marks, locale: "en" })),
		),
	);
	return host;
}

const style = (element: Element, pseudo?: string) => getComputedStyle(element, pseudo);
const px = (value: string) => Number.parseFloat(value);
const canvas = document.createElement("canvas");
canvas.width = canvas.height = 1;
const paint = canvas.getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D;
/** What the eye sees of colours laid one over another (any CSS colour, translucent ones too), as red, green, blue. */
const flat = (...layers: string[]): Rgb => {
	paint.clearRect(0, 0, 1, 1);
	for (const layer of layers) {
		paint.fillStyle = layer;
		paint.fillRect(0, 0, 1, 1);
	}
	const [r, g, b] = paint.getImageData(0, 0, 1, 1).data;
	return [r, g, b];
};
const rgbOf = (color: string) => flat(color);

const callout = (tone: string, title: string): Block => ({
	id: `c_${tone}`,
	type: "callout",
	attrs: { tone, title },
	children: [p(`p_${tone}`, "Body words of the callout.")],
});

describe.each(["light", "dark"] as const)("18-2 the callout's look, in the %s page", (mode) => {
	it("18-2 the kind is the bar and an icon in the text colour, never colour alone; the title and the words are the page's own colour and size", () => {
		const page = draw(
			doc(
				p("o", "A paragraph outside."),
				...["note", "tip", "info", "warning", "danger"].map((tone) => callout(tone, `Title ${tone}`)),
			),
			{ mode },
		);
		const boxes = [...page.querySelectorAll<HTMLElement>(".monti-block-callout")];
		expect(boxes).toHaveLength(5);
		const outside = page.querySelector("p") as HTMLElement;
		for (const box of boxes) {
			const frame = style(box);
			expect(frame.borderInlineStartWidth).toBe("4px");
			for (const side of ["Top", "Right", "Bottom"] as const) expect(frame[`border${side}Width`]).toBe("0px");
			expect(frame.borderTopLeftRadius).toBe("0px");
			// The kind is named for a screen reader too, whatever the title says.
			expect(box.getAttribute("aria-label")).toBe(
				box.getAttribute("data-tone")?.replace(/^./, (letter) => letter.toUpperCase()),
			);
			const title = box.querySelector<HTMLElement>(".monti-block-callout-title") as HTMLElement;
			const icon = style(title, "::before");
			expect(icon.maskImage || icon.webkitMaskImage).toContain("svg");
			expect(px(icon.width)).toBeGreaterThan(14);
			// The icon is drawn in the text colour: it reads on the box as the words do (3:1 for a picture, and the words 4.5:1).
			expect(icon.backgroundColor).toBe(style(title).color);
			const ground = flat(PAGES[mode].ground, frame.backgroundColor);
			expect(contrastOf(rgbOf(icon.backgroundColor), ground)).toBeGreaterThanOrEqual(4.5);
			expect(contrastOf(rgbOf(style(title).color), ground)).toBeGreaterThanOrEqual(4.5);
			// The title and the words are the page's own text colour and size.
			expect(style(title).color).toBe(style(outside).color);
			expect(style(title).fontSize).toBe(style(outside).fontSize);
			expect(style(box.querySelector("p") as Element).fontSize).toBe(style(outside).fontSize);
		}
		// Five kinds, five bars and five icons.
		expect(new Set(boxes.map((box) => style(box).borderInlineStartColor)).size).toBe(5);
		expect(
			new Set(
				boxes.map((box) => style(box.querySelector(".monti-block-callout-title") as Element, "::before").maskImage),
			).size,
		).toBe(5);
	});
});

describe("18-2 the callout's room", () => {
	it("18-2 the space under the words is the space over the title, and a title alone draws no body", () => {
		const page = draw(
			doc(callout("tip", "Title"), { id: "alone", type: "callout", attrs: { tone: "info", title: "Only a title" } }),
		);
		const [box, alone] = [...page.querySelectorAll<HTMLElement>(".monti-block-callout")];
		const title = box.querySelector(".monti-block-callout-title") as HTMLElement;
		const words = box.querySelector("p") as HTMLElement;
		const over = title.getBoundingClientRect().top - box.getBoundingClientRect().top;
		const under = box.getBoundingClientRect().bottom - words.getBoundingClientRect().bottom;
		expect(over).toBeCloseTo(12, 0);
		expect(under).toBeCloseTo(12, 0);
		expect(alone.querySelector(".monti-block-callout-body")).toBeNull();
	});

	it("18-2 a code box inside a callout has no frame of its own", () => {
		const inside: Block = {
			id: "c",
			type: "callout",
			attrs: { tone: "note", title: "Code" },
			children: [
				{ id: "k", type: "codeBlock", attrs: { language: "ts" }, content: [{ type: "text", text: "const a = 1;" }] },
			],
		};
		const figure = draw(doc(inside)).querySelector("figure[data-code]") as HTMLElement;
		expect(style(figure).borderTopColor).toBe("rgba(0, 0, 0, 0)");
	});
});

describe.each(["light", "dark"] as const)("18-2 the tabs' look, in the %s page", (mode) => {
	const tabs = (count: number): Block => ({
		id: "tabs",
		type: "tabs",
		children: Array.from({ length: count }, (_, at) => ({
			id: `t${at}`,
			type: "tab",
			attrs: { label: `A tab named ${at + 1}` },
			children: [p(`tp${at}`, `Panel ${at + 1}`)],
		})),
	});

	it("18-2 the open tab joins the box under it (no line between them) and the others are closed and grey; the box has one frame, square where the open tab joins it", () => {
		const page = draw(doc(tabs(3)), { mode });
		const [open, other] = [...page.querySelectorAll<HTMLElement>('[role="tab"]')];
		expect(open.getAttribute("aria-selected")).toBe("true");
		// No line under the open tab: its bottom edge is its own ground, which covers the box's top line; the closed tab keeps its line.
		expect(style(open).borderBottomColor).toBe(style(open).backgroundColor);
		expect(style(other).borderBottomColor).not.toBe(style(other).backgroundColor);
		expect(style(open).borderBottomWidth).toBe("1px");
		expect(style(open).borderTopLeftRadius).toBe("8px");
		expect(style(open).borderBottomLeftRadius).toBe("0px");
		const panel = page.querySelector<HTMLElement>(
			'[role="tabpanel"]:not([hidden]) > .monti-block-tabs-panel',
		) as HTMLElement;
		const box = style(panel);
		for (const side of ["Top", "Right", "Bottom", "Left"] as const) expect(box[`border${side}Width`]).toBe("1px");
		expect(box.borderTopLeftRadius).toBe("0px");
		expect(box.borderBottomRightRadius).toBe("8px");
		// One frame: nothing inside is a box with a ground or a line of its own.
		for (const inside of panel.querySelectorAll("*")) {
			expect(style(inside).backgroundColor).toBe("rgba(0, 0, 0, 0)");
			expect(style(inside).borderTopWidth).toBe("0px");
		}
		// The open tab sits over the box's top line by exactly that line.
		expect(Math.round(open.getBoundingClientRect().bottom - panel.getBoundingClientRect().top)).toBe(1);
	});

	it("18-2 a short name keeps its natural width: a tab is never wider than its name, in a row that fits and in a full one", () => {
		const named = (label: string, at: number): Block => ({
			id: `t${at}`,
			type: "tab",
			attrs: { label },
			children: [p(`tp${at}`, "Panel")],
		});
		const labels = ["npm", "A very long name of a tab", "Another very long name of a tab"];
		const natural = (tab: HTMLElement) => {
			const words = document.createRange();
			words.selectNodeContents(tab.querySelector(".monti-block-tabs-text") as Element);
			const box = style(tab);
			return words.getBoundingClientRect().width + px(box.paddingLeft) + px(box.paddingRight) + 2;
		};
		for (const width of [900, 320]) {
			const page = draw(doc({ id: "tabs", type: "tabs", children: labels.map(named) }), { width, mode });
			const short = page.querySelector<HTMLElement>('[role="tab"]') as HTMLElement;
			// "npm" is its own width; at 900 nothing is cut, and at 320 the long names give way before it does.
			expect(short.getBoundingClientRect().width).toBeCloseTo(natural(short), 0);
			root?.unmount();
			host?.remove();
			host = null;
			root = null;
		}
	});

	it("18-2 the tabs of a full row shrink first, their names ending in an ellipsis, and the row does not scroll while they fit", () => {
		const page = draw(doc(tabs(3)), { width: 320, mode });
		const list = page.querySelector<HTMLElement>('[role="tablist"]') as HTMLElement;
		expect(list.scrollWidth).toBeLessThanOrEqual(list.clientWidth + 1);
		const names = [...page.querySelectorAll<HTMLElement>(".monti-block-tabs-text")];
		expect(names.some((name) => name.scrollWidth > name.clientWidth)).toBe(true);
		expect(names.every((name) => (name.parentElement as HTMLElement).title !== "")).toBe(true);
	});

	it("18-2 tabs that do not fit even shrunk scroll sideways in their row and never up and down, and not the page", () => {
		const page = draw(doc(tabs(8)), { width: 360, mode });
		const list = page.querySelector<HTMLElement>('[role="tablist"]') as HTMLElement;
		expect(list.scrollWidth).toBeGreaterThan(list.clientWidth);
		expect(style(list).overflowX).toBe("auto");
		expect(style(list).overflowY).toBe("hidden");
		expect(list.scrollHeight).toBeLessThanOrEqual(list.clientHeight);
		const open = page.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]') as HTMLElement;
		expect(open.getBoundingClientRect().bottom).toBeLessThanOrEqual(list.getBoundingClientRect().bottom + 0.5);
		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(document.documentElement.clientWidth);
	});
});

describe("18-2 the footnote and the file link", () => {
	it("18-2 a footnote's number sits against its word and is pressable over 24px; a file link adds its kind and size", () => {
		const page = draw(
			doc(
				{
					id: "para",
					type: "paragraph",
					content: [
						{ type: "text", text: "A word" },
						{ type: "footnoteRef", id: "1" },
					],
				},
				{ id: "note", type: "footnote", attrs: { id: "1" }, content: [{ type: "text", text: "The note." }] },
			),
		);
		const link = page.querySelector<HTMLElement>('sup > a[href^="#fn-"]') as HTMLElement;
		const target = link.getBoundingClientRect();
		expect(target.width).toBeGreaterThanOrEqual(24);
		expect(target.height).toBeGreaterThanOrEqual(24);
		const digit = document.createRange();
		digit.selectNodeContents(link);
		const word = document.createRange();
		word.selectNodeContents(link.parentElement?.previousSibling as Node);
		expect(digit.getBoundingClientRect().left - word.getBoundingClientRect().right).toBeLessThanOrEqual(2);
	});
});

describe("18-2 the formula's look", () => {
	const formula = (source: string): Block => ({ id: "m", type: "math", attrs: { source } });

	it("18-2 KaTeX draws with its stylesheet: its letters in its own font, a matrix with space between its columns, the MathML kept apart for readers of the text", async () => {
		const page = draw(doc(formula("\\begin{pmatrix} 1 & 2 \\\\ 3 & 4 \\end{pmatrix}")));
		await document.fonts.ready;
		const katex = page.querySelector<HTMLElement>(".katex") as HTMLElement;
		expect(style(katex).fontFamily).toContain("KaTeX_Main");
		const mathml = page.querySelector<HTMLElement>(".katex-mathml") as HTMLElement;
		expect(style(mathml).position).toBe("absolute");
		expect(px(style(mathml).width)).toBeLessThanOrEqual(1);
		const cell = (digit: string) =>
			[...page.querySelectorAll<HTMLElement>(".katex-html .mord")].find(
				(each) => each.textContent === digit,
			) as HTMLElement;
		expect(cell("2").getBoundingClientRect().left - cell("1").getBoundingClientRect().right).toBeGreaterThan(10);
		// The letters are the page's colour.
		expect(style(katex).color).toBe(style(page).color);
	});

	it("18-2 a formula that does not read is its source, with no message of KaTeX's for the reader", () => {
		const page = draw(doc(formula("\\frac{1}{")));
		expect(page.querySelector("figure")?.getAttribute("data-state")).toBe("error");
		expect(page.textContent).toBe("\\frac{1}{");
	});
});

describe("18-2 the diagram's look", () => {
	const diagram = (source: string): Block => ({ id: "d", type: "mermaid", attrs: { source } });
	const drawn = async (page: HTMLElement) => {
		await expect
			.poll(() => page.querySelector("figure")?.getAttribute("data-state"), { timeout: 20_000 })
			.toBe("ready");
		return page.querySelector("svg") as SVGSVGElement;
	};
	const fill = (element: Element) => rgbOf(style(element).fill);

	it("18-2 a diagram takes the page's colours and font, not Mermaid's lilac, and its box is as high as the drawing and its padding", async () => {
		const page = draw(doc(diagram("flowchart LR\n  A[Start] --> B[Finish]")));
		const svg = await drawn(page);
		const node = svg.querySelector(".node rect, .node polygon") as SVGElement;
		expect(style(node).fill).not.toBe("rgb(236, 236, 255)");
		expect(style(node).stroke).not.toBe("rgb(147, 112, 219)");
		expect(style(svg.querySelector("text, .nodeLabel") as Element).fontFamily).toContain("system-ui");
		const figure = page.querySelector("figure") as HTMLElement;
		const slack = figure.getBoundingClientRect().height - svg.getBoundingClientRect().height;
		// The figure's own padding (1rem over and under) and nothing else.
		expect(slack).toBeLessThanOrEqual(34);
		expect(slack).toBeGreaterThanOrEqual(30);
	});

	it("18-2 in the dark page the same diagram is drawn dark, its words the page's light colour", async () => {
		const page = draw(doc(diagram("flowchart LR\n  A[Start] --> B[Finish]")), { mode: "dark" });
		const svg = await drawn(page);
		const node = svg.querySelector(".node rect, .node polygon") as SVGElement;
		expect(contrastOf(fill(node), rgbOf(PAGES.dark.ground))).toBeLessThan(2);
		const words = svg.querySelector(".nodeLabel, text") as Element;
		const wordColour = rgbOf(style(words).color);
		expect(contrastOf(wordColour, rgbOf(PAGES.dark.ground))).toBeGreaterThanOrEqual(4.5);
		expect(contrastOf(wordColour, fill(node))).toBeGreaterThanOrEqual(4.5);
	});

	it("18-2 a diagram is drawn again when the site changes its own theme", async () => {
		const page = draw(doc(diagram("flowchart LR\n  A[Start] --> B[Finish]")));
		const svg = await drawn(page);
		const before = style(svg.querySelector(".node rect, .node polygon") as Element).fill;
		page.style.cssText += `;color:${PAGES.dark.ink};background:${PAGES.dark.ground};`;
		document.documentElement.classList.add("dark");
		await expect
			.poll(() => style(page.querySelector(".node rect, .node polygon") as Element).fill, { timeout: 20_000 })
			.not.toBe(before);
	});

	it("18-2 diagrams drawn together are all drawn (one at a time through Mermaid)", async () => {
		const page = draw(
			doc(
				diagram("flowchart LR\n  A --> B"),
				{ ...diagram("flowchart TD\n  C --> D"), id: "d2" },
				{ ...diagram('pie title P\n  "A": 3\n  "B": 2'), id: "d3" },
			),
		);
		await expect.poll(() => page.querySelectorAll("figure[data-state=ready] svg").length, { timeout: 30_000 }).toBe(3);
	});

	it.each([
		"light",
		"dark",
	] as const)("18-2 a schedule's letters are never under 12px and the open task and its words read on each other (%s)", async (mode) => {
		const page = draw(
			doc(
				diagram(
					"gantt\n  title Plan\n  dateFormat YYYY-MM-DD\n  section Build\n  Design :done, a1, 2026-11-01, 5d\n  Code :active, a2, after a1, 7d\n  Ship :crit, a3, after a2, 3d",
				),
			),
			{ mode },
		);
		const svg = await drawn(page);
		const sizes = [...svg.querySelectorAll("text")].map((text) => px(style(text).fontSize));
		expect(sizes.length).toBeGreaterThan(0);
		expect(Math.min(...sizes)).toBeGreaterThanOrEqual(12);
		const ground = rgbOf(PAGES[mode].ground);
		for (const kind of ["active", "done", "crit"]) {
			const bar = svg.querySelector(`rect[class*="${kind}"]`) as SVGElement;
			const words = svg.querySelector(`[class*="${kind}Text"]`) as Element;
			expect(bar, kind).not.toBeNull();
			expect(contrastOf(rgbOf(style(words).fill), fill(bar)), `${kind} words on the bar`).toBeGreaterThanOrEqual(4.5);
			expect(contrastOf(rgbOf(style(bar).stroke), ground), `${kind} edge on the page`).toBeGreaterThanOrEqual(3);
		}
	});

	it.each([
		"light",
		"dark",
	] as const)("18-2 a pie's labels read on their slices and the slices stand against the page (%s)", async (mode) => {
		const page = draw(doc(diagram('pie title Share\n  "Alpha": 40\n  "Beta": 30\n  "Gamma": 20\n  "Delta": 10')), {
			mode,
		});
		const svg = await drawn(page);
		const ground = rgbOf(PAGES[mode].ground);
		const slices = [...svg.querySelectorAll<SVGElement>(".pieCircle")];
		const labels = [...svg.querySelectorAll<SVGElement>(".slice")];
		expect(slices.length).toBe(4);
		expect(labels.length).toBe(4);
		slices.forEach((slice, at) => {
			expect(contrastOf(rgbOf(style(labels[at]).fill), fill(slice)), `label ${at}`).toBeGreaterThanOrEqual(4.5);
			expect(contrastOf(fill(slice), ground), `slice ${at}`).toBeGreaterThanOrEqual(3);
		});
	});
});
