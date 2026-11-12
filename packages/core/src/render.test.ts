import { describe, expect, it } from "vitest";
import type { Block, Doc } from "./body/doc";
import { type BlockProps, type CreateElement, renderDocument, tocOf } from "./render";

const html: CreateElement<string> = (type, props, ...children) => {
	if (typeof type === "function")
		return (type as (props: unknown) => string)({ ...props, children: children.join("") });
	const attrs = Object.entries(props ?? {})
		.filter(([name, value]) => name !== "key" && value !== undefined && typeof value !== "object")
		.map(([name, value]) => ` ${name}="${value}"`)
		.join("");
	return `<${type}${attrs}>${children.join("")}</${type}>`;
};
let next = 0;
const heading = (level: number, text: string): Block => ({
	id: `b_${++next}`,
	type: "heading",
	attrs: { level },
	content: [{ type: "text", text }],
});
const doc = (...blocks: Block[]): Doc => ({ type: "doc", blocks });
const draw = (body: Doc) => renderDocument(body, { createElement: html }).join("");

describe("heading anchors and the table of contents", () => {
	it("16-6 every heading has an id made of its words, and tocOf gives the level 2 and 3 headings with the same ids", () => {
		const body = doc(
			heading(2, "Why we moved"),
			heading(3, "What it cost, in days"),
			heading(4, "A detail"),
			{ id: "p", type: "paragraph", content: [{ type: "text", text: "글" }] },
			heading(2, "Next"),
		);
		expect(draw(body)).toBe(
			'<h2 id="why-we-moved">Why we moved</h2><h3 id="what-it-cost-in-days">What it cost, in days</h3><h4 id="a-detail">A detail</h4><p>글</p><h2 id="next">Next</h2>',
		);
		expect(tocOf(body)).toEqual([
			{ id: "why-we-moved", text: "Why we moved", level: 2, depth: 0 },
			{ id: "what-it-cost-in-days", text: "What it cost, in days", level: 3, depth: 1 },
			{ id: "next", text: "Next", level: 2, depth: 0 },
		]);
		expect(tocOf(body, { min: 3, max: 4 }).map((item) => [item.id, item.depth])).toEqual([
			["what-it-cost-in-days", 0],
			["a-detail", 1],
		]);
		expect(tocOf(doc())).toEqual([]);
	});

	it("16-6 two headings with the same words have different ids, a Korean heading's id is Korean, and one with no letter is 'section'", () => {
		const body = doc(
			heading(2, "무엇을 덜어냈나"),
			heading(2, "무엇을 덜어냈나"),
			heading(2, "?!"),
			heading(2, "…"),
			heading(3, "C++ & Rust_2"),
		);
		expect(tocOf(body).map((item) => item.id)).toEqual([
			"무엇을-덜어냈나",
			"무엇을-덜어냈나-1",
			"section",
			"section-1",
			"c-rust_2",
		]);
		expect(draw(body)).toContain('<h2 id="무엇을-덜어냈나-1">');
	});

	it("16-6 a heading's id never looks like a footnote's, and a heading inside a quote is anchored too", () => {
		const body = doc(heading(2, "fn-1"), heading(2, "fnref 2"), {
			id: "q",
			type: "quote",
			children: [heading(3, "Inside")],
		});
		expect(tocOf(body).map((item) => item.id)).toEqual(["h-fn-1", "h-fnref-2", "inside"]);
		expect(draw(body)).toContain('<blockquote><h3 id="inside">Inside</h3></blockquote>');
	});

	it("16-6 the site's own heading component gets the id as `anchor`", () => {
		const Site = ({ anchor, children }: BlockProps & { children?: string }) =>
			`<h2 class="mine" id="${anchor}">${children}</h2>`;
		const drawn = renderDocument(doc(heading(2, "Mine")), {
			createElement: html,
			// biome-ignore lint/suspicious/noExplicitAny: a test's block definition with only what the renderer reads
			blocks: [{ type: "heading", Site } as any],
		}).join("");
		expect(drawn).toBe('<h2 class="mine" id="mine">Mine</h2>');
	});
});
