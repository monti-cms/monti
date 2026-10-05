import { describe, expect, it } from "vitest";
import { analyze, type CmsNode, serialize, toDocument } from "..";

const linkDoc = (href: string, title?: string, text = "label"): CmsNode => ({
	type: "doc",
	content: [
		{
			type: "paragraph",
			content: [
				{
					type: "text",
					text,
					marks: [{ type: "link", attrs: { href, ...(title === undefined ? {} : { title }) } }],
				},
			],
		},
	],
});

const imageDoc = (src: string, alt: string, title?: string): CmsNode => ({
	type: "doc",
	content: [{ type: "image", attrs: { src, alt, ...(title === undefined ? {} : { title }) } }],
});

const reparse = (doc: CmsNode) => toDocument(analyze(serialize(doc)));

const linkAttrs = (doc: CmsNode) => doc.content?.[0]?.content?.[0]?.marks?.[0]?.attrs;

describe("link and image serialization escapes", () => {
	it.each([
		["spaces", "https://example.com/a b/c"],
		["a closing parenthesis", "https://example.com/a)b"],
		["an opening parenthesis", "https://example.com/a(b"],
		["balanced parentheses", "https://en.wikipedia.org/wiki/Foo_(bar)"],
		["angle brackets", "https://example.com/<a>"],
		["a backslash", "https://example.com/a\\b"],
		["a backslash before punctuation", "https://example.com/a\\(b"],
		["an entity-like sequence", "https://example.com/?a=1&amp;b=2"],
		["a query string", "https://example.com/?a=1&b=2"],
		["a leading angle bracket", "<https://example.com>"],
	])("round-trips a link href with %s", (_name, href) => {
		expect(linkAttrs(reparse(linkDoc(href)))).toEqual({ href });
	});

	it("round-trips a link title with quotes, backslashes and entity-like text", () => {
		const title = 'say "hi" \\ &amp; (x)';
		expect(linkAttrs(reparse(linkDoc("https://example.com", title)))).toEqual({
			href: "https://example.com",
			title,
		});
	});

	it("round-trips a link with both an awkward href and an awkward title", () => {
		const attrs = { href: "https://example.com/a b)", title: 'a "b"' };
		expect(linkAttrs(reparse(linkDoc(attrs.href, attrs.title)))).toEqual(attrs);
	});

	it("writes plain destinations unchanged", () => {
		expect(serialize(linkDoc("https://example.com/a(b)c", "T")).trim()).toBe('[label](https://example.com/a(b)c "T")');
	});

	it.each([
		["spaces", "https://example.com/a b.png"],
		["parentheses", "https://example.com/a(b.png"],
	])("round-trips an image src with %s", (_name, src) => {
		expect(reparse(imageDoc(src, "alt")).content?.[0]?.attrs).toEqual({ src, alt: "alt" });
	});

	it("round-trips an image title with quotes", () => {
		const title = 'a "b" c';
		expect(reparse(imageDoc("/p.png", "alt", title)).content?.[0]?.attrs).toEqual({ src: "/p.png", alt: "alt", title });
	});

	it.each([
		["a closing bracket", "a]b"],
		["an opening bracket", "a[b"],
		["balanced brackets", "a [b] c"],
		["a backslash", "a\\b"],
		["emphasis characters", "*a* _b_"],
	])("round-trips image alt text with %s", (_name, alt) => {
		expect(reparse(imageDoc("/p.png", alt)).content?.[0]?.attrs).toEqual({ src: "/p.png", alt });
	});

	it.each([
		["a closing bracket", "a]b"],
		["an opening bracket", "a[b"],
		["balanced brackets", "a [b] c"],
		["a trailing bracket", "see [1]"],
		["a backslash", "a\\b"],
		["emphasis characters", "*a* _b_"],
	])("round-trips link text with %s", (_name, text) => {
		const doc = reparse(linkDoc("https://example.com", undefined, text));
		const paragraph = doc.content?.[0];
		expect(doc.content).toHaveLength(1);
		expect(paragraph?.content).toEqual([
			{ type: "text", text, marks: [{ type: "link", attrs: { href: "https://example.com" } }] },
		]);
	});

	it("keeps link text with a bracket idempotent", () => {
		const once = serialize(linkDoc("/x", undefined, "a]b"));
		expect(serialize(toDocument(analyze(once)))).toBe(once);
	});
});
