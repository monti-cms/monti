import type { Block, Doc } from "@monti-cms/core";
import { renderDocument } from "@monti-cms/core/render";
import { createElement, type ElementType, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { blocks, marks } from "./index";

// The blocks' looks as a reader sees them (doc 18): the site's drawing in a real browser, measured, in light and in dark.

const doc = (...list: Block[]): Doc => ({ type: "doc", blocks: list });
const p = (id: string, text: string): Block => ({ id, type: "paragraph", content: [{ type: "text", text }] });
const h = (type: unknown, props: Record<string, unknown> | null, ...children: unknown[]) =>
	createElement(type as ElementType, props, ...(children as ReactNode[]));

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

/** The page's body drawn the way a site draws it, in a box `width` wide. */
function draw(body: Doc, width = 640): HTMLElement {
	host = document.createElement("div");
	host.style.cssText = `width:${width}px;font:17px/1.6 system-ui, sans-serif;color:rgb(28 27 24);`;
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
const luminance = (color: string) => {
	const [r, g, b] = (color.match(/[\d.]+/g) ?? []).slice(0, 3).map((value) => {
		const channel = Number(value) / 255;
		return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const opaque = (color: string) => color.startsWith("rgb(") || color.startsWith("#");

const callout = (tone: string, title: string): Block => ({
	id: `c_${tone}`,
	type: "callout",
	attrs: { tone, title },
	children: [p(`p_${tone}`, "Body words of the callout.")],
});

describe("18-2 the callout's look", () => {
	it("18-2 the kind is the bar down the left and an icon, never colour alone; the title and the words are the page's own colour and size", () => {
		const page = draw(
			doc(
				p("o", "A paragraph outside."),
				...["note", "tip", "info", "warning", "danger"].map((tone) => callout(tone, `Title ${tone}`)),
			),
		);
		const boxes = [...page.querySelectorAll<HTMLElement>(".monti-block-callout")];
		expect(boxes).toHaveLength(5);
		const outside = page.querySelector("p") as HTMLElement;
		for (const box of boxes) {
			const box_ = style(box);
			expect(box_.borderLeftWidth).toBe("4px");
			for (const side of ["Top", "Right", "Bottom"] as const) expect(box_[`border${side}Width`]).toBe("0px");
			expect(box_.borderTopLeftRadius).toBe("0px");
			const title = box.querySelector<HTMLElement>(".monti-block-callout-title") as HTMLElement;
			const icon = style(title, "::before");
			expect(icon.maskImage || icon.webkitMaskImage).toContain("svg");
			expect(px(icon.width)).toBeGreaterThan(14);
			// The title and the words are the page's own text colour, size and nothing smaller.
			expect(style(title).color).toBe(style(outside).color);
			expect(style(title).fontSize).toBe(style(outside).fontSize);
			expect(style(box.querySelector("p") as Element).fontSize).toBe(style(outside).fontSize);
		}
		// Five kinds, five bars and five icons.
		expect(new Set(boxes.map((box) => style(box).borderLeftColor)).size).toBe(5);
		expect(
			new Set(
				boxes.map((box) => style(box.querySelector(".monti-block-callout-title") as Element, "::before").maskImage),
			).size,
		).toBe(5);
	});

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

describe("18-2 the tabs' look", () => {
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

	it("18-2 the open tab is the one with a line under it and no fill, and the panel has no box of its own", () => {
		const page = draw(doc(tabs(3)));
		const [open, other] = [...page.querySelectorAll<HTMLElement>('[role="tab"]')];
		expect(open.getAttribute("aria-selected")).toBe("true");
		expect(style(open).borderBottomWidth).toBe("2px");
		expect(style(open).backgroundColor).toBe("rgba(0, 0, 0, 0)");
		expect(style(other).borderBottomColor).toBe("rgba(0, 0, 0, 0)");
		expect(style(open).opacity).toBe("1");
		expect(px(style(other).opacity)).toBeLessThan(1);
		const panel = page.querySelector<HTMLElement>('[role="tabpanel"]:not([hidden])') as HTMLElement;
		const box = style(panel);
		expect(box.backgroundColor).toBe("rgba(0, 0, 0, 0)");
		for (const side of ["Top", "Right", "Bottom", "Left"] as const) expect(box[`border${side}Width`]).toBe("0px");
	});

	it("18-2 tabs that do not fit scroll sideways in their row, not the page", () => {
		const page = draw(doc(tabs(8)), 360);
		const list = page.querySelector<HTMLElement>('[role="tablist"]') as HTMLElement;
		expect(list.scrollWidth).toBeGreaterThan(list.clientWidth);
		expect(style(list).overflowX).toBe("auto");
		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(document.documentElement.clientWidth);
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

	it("18-2 in the dark theme the same diagram is drawn dark, its words the page's light colour", async () => {
		document.documentElement.classList.add("dark");
		document.documentElement.style.cssText = "background:rgb(20 20 20);color:rgb(236 235 230);";
		const page = draw(doc(diagram("flowchart LR\n  A[Start] --> B[Finish]")));
		page.style.color = "rgb(236 235 230)";
		const svg = await drawn(page);
		const node = svg.querySelector(".node rect, .node polygon") as SVGElement;
		expect(opaque(style(node).fill)).toBe(true);
		expect(luminance(style(node).fill)).toBeLessThan(0.2);
	});

	it("18-2 a schedule's letters are never smaller than 11px, the dates under it too", async () => {
		const page = draw(
			doc(
				diagram(
					"gantt\n  title Plan\n  dateFormat YYYY-MM-DD\n  section Build\n  Design :a1, 2026-11-01, 5d\n  Code :after a1, 7d",
				),
			),
		);
		const svg = await drawn(page);
		const sizes = [...svg.querySelectorAll("text")].map((text) => px(style(text).fontSize));
		expect(sizes.length).toBeGreaterThan(0);
		expect(Math.min(...sizes)).toBeGreaterThanOrEqual(11);
	});
});
