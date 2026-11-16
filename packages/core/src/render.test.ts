import { describe, expect, it } from "vitest";
import type { Block, Doc } from "./body/doc";
import { type BlockProps, type CreateElement, renderDocument, tocOf } from "./render";
import { siteDoc } from "./translations/source";

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

describe("blocks kept in the source's words", () => {
	const paragraph = (id: string, words: string, extra: Partial<Block> = {}): Block => ({
		id,
		type: "paragraph",
		content: [{ type: "text", text: words }],
		...extra,
	});
	const link = (state: "pending" | "translated" | "keepSource" | "followSource") => ({
		link: { from: `s_${state}`, seen: "", state },
	});
	const drawn = (body: Doc, extra = {}) =>
		renderDocument(body, { createElement: html, locale: "en", ...extra }).join("");

	it("16-6 a translation as the reader hands it (siteDoc) draws `lang` on the blocks that keep or follow the source, and only on them", () => {
		const translation = doc(
			paragraph("a", "Hello", link("translated")),
			paragraph("b", "안녕", link("keepSource")),
			paragraph("c", "(own)", link("followSource")),
			paragraph("d", "later", link("pending")),
		);
		const source = doc(paragraph("s_followSource", "또"));
		expect(drawn(siteDoc(translation, source, "ko"))).toBe('<p>Hello</p><p lang="ko">안녕</p><p lang="ko">또</p>');
	});

	it("16-6 a body with no source language given (a source-language entry) carries no lang", () => {
		const translation = doc(paragraph("b", "안녕", link("keepSource")));
		expect(drawn(siteDoc(translation, null))).toBe("<p>안녕</p>");
	});

	it("16-6 a file link adds the file's kind and size to its name", () => {
		const files = doc({ id: "f", type: "file", attrs: { media: "m1", name: "Rates" } });
		const media = { m1: { url: "/f.pdf", name: "rates.pdf", mime: "application/pdf", size: 123_456 } } as never;
		expect(drawn(files, { media })).toBe(
			'<a href="/f.pdf" download="true">Rates <span data-file-meta="">PDF · 121 KB</span></a>',
		);
	});

	it("16-6 a file block's link, a code block's figure and a kept footnote carry it on their own root element", () => {
		const kept = link("keepSource");
		const files = siteDoc(
			doc(
				{ id: "f", type: "file", attrs: { media: "m1", name: "문서.pdf" }, ...kept },
				{ id: "k", type: "codeBlock", attrs: {}, content: [{ type: "text", text: "x" }], ...kept },
				{ id: "n", type: "footnote", attrs: { id: "1" }, content: [{ type: "text", text: "주" }], ...kept },
				paragraph("p", "글", {
					content: [
						{ type: "text", text: "글" },
						{ type: "footnoteRef", id: "1" },
					],
				}),
			),
			null,
			"ko",
		);
		const media = { m1: { url: "/f.pdf", name: "doc.pdf" } } as never;
		const out = drawn(files, { media });
		expect(out).toContain('<a href="/f.pdf" download="true" lang="ko">문서.pdf <span data-file-meta="">PDF</span></a>');
		expect(out).toContain('<figure data-code="" data-block="k" lang="ko">');
		expect(out).toContain('<li id="fn-1" lang="ko">');
	});

	it("16-6 a site component gets `lang` as a prop to put on its root element", () => {
		const Note = (props: Record<string, unknown>) => `<aside lang="${props.lang ?? ""}">${props.children}</aside>`;
		const note: Block = { id: "n", type: "note", content: [{ type: "text", text: "글" }], ...link("keepSource") };
		const blocks = [{ type: "note", Site: Note }] as never;
		expect(drawn(siteDoc(doc(note), null, "ko"), { blocks })).toBe('<aside lang="ko">글</aside>');
		expect(drawn(doc({ ...note, link: undefined }), { blocks })).toBe('<aside lang="">글</aside>');
	});
});
