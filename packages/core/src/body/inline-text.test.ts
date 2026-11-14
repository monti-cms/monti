import { describe, expect, it } from "vitest";
import { CheckError } from "../errors";
import type { Doc, Inline } from "./doc";
import { applyOps } from "./edit";
import { inlineToText, textToInline } from "./inline-text";
import { bodyText } from "./text";

const bold = { type: "bold" };
const italic = { type: "italic" };
const code = { type: "code" };
const link = { type: "link", href: "https://example.com/?a=1&b=2" };
const codeRef = { type: "codeRef", block: "b_code", anchor: "setup" };

const roundTrip = (content: Inline[]) => {
	const text = inlineToText(content);
	expect(textToInline(text)).toEqual(content);
	return text;
};

describe("03-3 a block's text with its marks as tags", () => {
	it("03-3 nested marks close inside out and open again only where they must", () => {
		expect(
			roundTrip([
				{ type: "text", text: "a", marks: [bold] },
				{ type: "text", text: "b", marks: [bold, italic] },
				{ type: "text", text: "c", marks: [bold] },
			]),
		).toBe("<bold>a<italic>b</italic>c</bold>");
	});

	it("03-3 overlapping marks are written nested: the one that reaches further is outside", () => {
		const text = inlineToText([
			{ type: "text", text: "a", marks: [bold] },
			{ type: "text", text: "b", marks: [italic, bold] },
			{ type: "text", text: "c", marks: [italic] },
		]);
		expect(text).toBe("<bold>a<italic>b</italic></bold><italic>c</italic>");
		expect(textToInline(text)).toEqual([
			{ type: "text", text: "a", marks: [bold] },
			{ type: "text", text: "b", marks: [bold, italic] },
			{ type: "text", text: "c", marks: [italic] },
		]);
	});

	it("03-3 a link keeps its address, and a bold word inside it stays bold", () => {
		expect(
			roundTrip([
				{ type: "text", text: "see " },
				{ type: "text", text: "the ", marks: [link] },
				{ type: "text", text: "docs", marks: [link, bold] },
			]),
		).toBe('see <link href="https://example.com/?a=1&amp;b=2">the <bold>docs</bold></link>');
	});

	it("03-3 a code link is a tag with its block and label, and attrs that are not text are JSON in braces", () => {
		expect(roundTrip([{ type: "text", text: "setup", marks: [codeRef] }])).toBe(
			'<codeRef block="b_code" anchor="setup">setup</codeRef>',
		);
		const plugin = { type: "badge", level: 2, tags: ["a", "}"], open: true };
		expect(roundTrip([{ type: "text", text: "new", marks: [plugin] }])).toBe(
			'<badge level={2} tags={["a","}"]} open={true}>new</badge>',
		);
	});

	it("03-3 a footnote reference closes itself and a hard break is a new line", () => {
		expect(
			roundTrip([
				{ type: "text", text: "one", marks: [bold] },
				{ type: "footnoteRef", id: "n1" },
				{ type: "hardBreak" },
				{ type: "text", text: "two", marks: [bold] },
			]),
		).toBe('<bold>one<footnoteRef id="n1"/>\ntwo</bold>');
	});

	it("03-3 the letters that make tags are escaped in words and attributes and read back", () => {
		expect(roundTrip([{ type: "text", text: 'a < b & c > "d"', marks: [{ type: "link", href: '/"x"' }] }])).toBe(
			'<link href="/&quot;x&quot;">a &lt; b &amp; c &gt; "d"</link>',
		);
		// What a model writes without escaping, where it cannot be a tag, is the letter itself.
		expect(textToInline("R&D: a < b")).toEqual([{ type: "text", text: "R&D: a < b" }]);
	});

	it("03-3 tags left open, closed out of order or closed without opening are refused with a reason", () => {
		for (const text of [
			"<bold>open",
			"<bold><italic>x</bold></italic>",
			"x</bold>",
			"<link href=/x>x</link>",
			"<bold/>",
		]) {
			const error = (() => {
				try {
					textToInline(text);
				} catch (caught) {
					return caught;
				}
			})();
			expect(error, text).toBeInstanceOf(CheckError);
			expect((error as CheckError).reason).toMatchObject({ key: "body.badMarkup" });
		}
	});
});

describe("03-3 setText", () => {
	const doc = (...blocks: Doc["blocks"]): Doc => ({ type: "doc", blocks });
	const marked: Inline[] = [
		{ type: "text", text: "Run " },
		{ type: "text", text: "npm test", marks: [code] },
		{ type: "text", text: " before you " },
		{ type: "text", text: "push", marks: [bold] },
		{ type: "text", text: ", as the " },
		{ type: "text", text: "guide", marks: [link] },
		{ type: "text", text: " says." },
	];

	it("03-3 a rewrite of a paragraph keeps its bold, link and code words: the text comes back with its tags", () => {
		const before = doc({ id: "b_1", type: "paragraph", content: marked });
		const read = bodyText(before);
		expect(read).toBe(
			'{#b_1} Run <code>npm test</code> before you <bold>push</bold>, as the <link href="https://example.com/?a=1&amp;b=2">guide</link> says.',
		);
		const next = applyOps(before, [
			{
				op: "setText",
				block: "b_1",
				text: 'Always run <code>npm test</code> before you <bold>push</bold>, as the <link href="https://example.com/?a=1&amp;b=2">guide</link> says.',
			},
		]);
		expect(next.blocks[0]?.content).toEqual([{ type: "text", text: "Always run " }, ...marked.slice(1)]);
	});

	it("03-3 a translation of a block gives its whole text: no word of the source is left over and a code link keeps its mark", () => {
		const before = doc({
			id: "b_1",
			type: "paragraph",
			content: [
				{ type: "text", text: "설정은 " },
				{ type: "text", text: "이 줄", marks: [codeRef] },
				{ type: "text", text: "에서 합니다." },
			],
		});
		const next = applyOps(before, [
			{ op: "setText", block: "b_1", text: 'Set it up on <codeRef block="b_code" anchor="setup">this line</codeRef>.' },
		]);
		expect(next.blocks[0]?.content).toEqual([
			{ type: "text", text: "Set it up on " },
			{ type: "text", text: "this line", marks: [codeRef] },
			{ type: "text", text: "." },
		]);
	});

	it("03-3 setText with tags that do not read changes nothing and says why", () => {
		const before = doc({ id: "b_1", type: "paragraph", content: [{ type: "text", text: "x" }] });
		expect(() => applyOps(before, [{ op: "setText", block: "b_1", text: "<bold>x" }])).toThrow(CheckError);
	});

	it("17-2 setText in a code block keeps the text effects of the code it did not change", () => {
		const before = doc({
			id: "b_code",
			type: "codeBlock",
			content: [
				{ type: "text", text: "const a = 1;", marks: [bold] },
				{ type: "text", text: "\nconst b = 2;" },
			],
		});
		const next = applyOps(before, [{ op: "setText", block: "b_code", text: "const a = 1;\nconst b = 3;" }]);
		expect(next.blocks[0]?.content).toEqual([
			{ type: "text", text: "const a = 1;", marks: [bold] },
			{ type: "text", text: "\nconst b = 3;" },
		]);
	});
});
