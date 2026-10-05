import { describe, expect, it } from "vitest";
import { analyze, type CmsNode, serialize, toDocument } from "..";

const parse = (mdx: string) => toDocument(analyze(mdx));
const roundTrip = (mdx: string) => serialize(parse(mdx));

describe("GFM footnotes in the document model", () => {
	it("turns a reference into an inline atom and a definition into a block", () => {
		const doc = parse("Text[^1] more.\n\n[^1]: The note.\n");
		expect(doc.content).toEqual([
			{
				type: "paragraph",
				content: [
					{ type: "text", text: "Text" },
					{ type: "footnoteReference", attrs: { label: "1" } },
					{ type: "text", text: " more." },
				],
			},
			{
				type: "footnoteDefinition",
				attrs: { label: "1" },
				content: [{ type: "paragraph", content: [{ type: "text", text: "The note." }] }],
			},
		]);
	});

	it("keeps labels as written and does not renumber them", () => {
		const doc = parse("a[^zebra] b[^Apple]\n\n[^zebra]: z\n\n[^Apple]: a\n");
		const labels = (doc.content?.[0]?.content ?? []).filter((n) => n.type === "footnoteReference");
		expect(labels.map((n) => n.attrs?.label)).toEqual(["zebra", "Apple"]);
		expect(doc.content?.slice(1).map((n) => n.attrs?.label)).toEqual(["zebra", "Apple"]);
		expect(roundTrip("a[^zebra] b[^Apple]\n\n[^zebra]: z\n\n[^Apple]: a\n")).toBe(
			"a[^zebra] b[^Apple]\n\n[^zebra]: z\n\n[^Apple]: a\n",
		);
	});

	it("keeps definitions where they appear in the source", () => {
		const mdx = "[^a]: first\n\nBody[^a]\n\n## Heading\n\nTail\n";
		expect(parse(mdx).content?.map((n) => n.type)).toEqual(["footnoteDefinition", "paragraph", "heading", "paragraph"]);
		expect(roundTrip(mdx)).toBe("[^a]: first\n\nBody[^a]\n\n## Heading\n\nTail\n");
	});

	it("keeps multi-block definition content (paragraphs, code and lists)", () => {
		const mdx = [
			"Body[^n]",
			"",
			"[^n]: First paragraph.",
			"",
			"    Second paragraph.",
			"",
			"    ```js",
			"    const a = 1;",
			"",
			"    const b = 2;",
			"    ```",
			"",
			"    - one",
			"    - two",
			"",
		].join("\n");
		const doc = parse(mdx);
		const definition = doc.content?.[1] as CmsNode;
		expect(definition.type).toBe("footnoteDefinition");
		expect(definition.content?.map((n) => n.type)).toEqual(["paragraph", "paragraph", "codeBlock", "bulletList"]);
		expect(serialize(doc)).toBe(mdx);
	});

	it.each([
		["a code block", "[^n]: ```js\n    x();\n    ```"],
		["a list", "[^n]: - one\n    - two"],
		["a quote", "[^n]: > quoted"],
	])("round-trips a definition that starts with %s", (_name, definition) => {
		const doc = parse(`a[^n]\n\n${definition}\n`);
		const first = (doc.content?.[1] as CmsNode).content?.[0]?.type;
		expect(first).not.toBe("paragraph");
		expect(parse(serialize(doc))).toEqual(doc);
	});

	it("indents continuation lines of a definition by four spaces", () => {
		const doc: CmsNode = {
			type: "doc",
			content: [
				{
					type: "footnoteDefinition",
					attrs: { label: "1" },
					content: [
						{ type: "paragraph", content: [{ type: "text", text: "a" }] },
						{ type: "paragraph", content: [{ type: "text", text: "b" }] },
					],
				},
			],
		};
		expect(serialize(doc)).toBe("[^1]: a\n\n    b\n");
	});

	it("keeps inline marks, links and nested references inside a definition", () => {
		const mdx = "x[^a]\n\n[^a]: See **bold**, [a link](/x) and `code`.\n";
		expect(roundTrip(mdx)).toBe(mdx);
	});

	it("keeps an empty definition", () => {
		const mdx = "Text[^1]\n\n[^1]:\n";
		const doc = parse(mdx);
		expect(doc.content?.[1]).toMatchObject({ type: "footnoteDefinition", attrs: { label: "1" } });
		expect(roundTrip(mdx)).toBe(mdx);
	});

	it("keeps references in headings, list items, quotes and table cells", () => {
		const mdx = [
			"## Title[^a]",
			"",
			"- item[^b]",
			"",
			"> quote[^c]",
			"",
			"| h |",
			"| --- |",
			"| cell[^d] |",
			"",
			"[^a]: a",
			"",
			"[^b]: b",
			"",
			"[^c]: c",
			"",
			"[^d]: d",
			"",
		].join("\n");
		expect(roundTrip(mdx)).toBe(mdx);
	});

	it("keeps a reference next to formatting", () => {
		const mdx = "**bold**[^a] and *it*[^a]\n\n[^a]: x\n";
		expect(roundTrip(mdx)).toBe(mdx);
	});

	it("is idempotent: doc to MDX to doc equals the doc", () => {
		const mdx = [
			"A[^1] and B[^note] and A again[^1].",
			"",
			"[^1]: one",
			"",
			"[^note]: two",
			"",
			"    ```ts",
			"    x();",
			"    ```",
			"",
		].join("\n");
		const doc = parse(mdx);
		expect(parse(serialize(doc))).toEqual(doc);
		expect(serialize(parse(serialize(doc)))).toBe(serialize(doc));
	});

	it("keeps duplicate definitions so validation can report them", () => {
		const doc = parse("a[^a]\n\n[^a]: one\n\n[^a]: two\n");
		expect(doc.content?.filter((n) => n.type === "footnoteDefinition")).toHaveLength(2);
	});

	it("does not treat an escaped or code-span marker as a reference", () => {
		const mdx = "\\[^a] and `[^a]`\n\n[^a]: x\n";
		const doc = parse(mdx);
		expect(JSON.stringify(doc)).not.toContain('"footnoteReference"');
		expect(roundTrip(mdx)).toBe(mdx);
	});

	it("keeps an orphan reference (no definition) as a reference across any number of saves", () => {
		const doc = parse("Text[^1] here.\n\n[^1]: Note.\n");
		// As an editor delete does: drop the definition and keep the reference.
		const orphan: CmsNode = { ...doc, content: doc.content?.filter((n) => n.type !== "footnoteDefinition") };
		const once = serialize(orphan);
		expect(once).toBe("Text[^1] here.\n");
		const reparsed = parse(once);
		expect(reparsed).toEqual(orphan);
		expect(serialize(reparsed)).toBe(once);
		expect(serialize(parse(serialize(reparsed)))).toBe(once);
		expect(parse(serialize(parse(once)))).toEqual(orphan);
	});

	it("keeps an orphan reference inside formatting, headings and table cells", () => {
		const mdx = "## Title[^a]\n\n**bold**[^b] and `code[^c]`\n\n| h |\n| --- |\n| cell[^d] |\n";
		const doc = parse(mdx);
		const references = JSON.stringify(doc).match(/"footnoteReference"/g) ?? [];
		expect(references).toHaveLength(3);
		expect(serialize(doc)).toBe("## Title[^a]\n\n**bold**[^b] and `code[^c]`\n\n| h |\n| --- |\n| cell[^d] |\n");
		expect(serialize(parse(serialize(doc)))).toBe(serialize(doc));
	});

	it("keeps a literally escaped marker as text", () => {
		const once = roundTrip("a \\[^1] b\n");
		expect(once).toBe("a \\[^1] b\n");
		expect(JSON.stringify(parse(once))).not.toContain("footnoteReference");
		expect(roundTrip(once)).toBe(once);
		// An escaped backslash followed by a real marker is still a reference.
		expect(JSON.stringify(parse("a \\\\[^1] b\n"))).toContain("footnoteReference");
	});

	it("reconnects an orphan reference when its definition is added back", () => {
		const orphan = serialize({
			type: "doc",
			content: [
				{
					type: "paragraph",
					content: [
						{ type: "text", text: "Text" },
						{ type: "footnoteReference", attrs: { label: "1" } },
						{ type: "text", text: " here." },
					],
				},
			],
		});
		const restored = parse(`${orphan}\n[^1]: Note.\n`);
		expect(restored.content?.map((n) => n.type)).toEqual(["paragraph", "footnoteDefinition"]);
		expect(restored.content?.[0]?.content?.[1]).toEqual({ type: "footnoteReference", attrs: { label: "1" } });
		expect(serialize(restored)).toBe("Text[^1] here.\n\n[^1]: Note.\n");
	});

	it("escapes unsafe characters in a label when writing", () => {
		const doc: CmsNode = {
			type: "doc",
			content: [
				{
					type: "paragraph",
					content: [{ type: "footnoteReference", attrs: { label: "a b]" } }],
				},
				{
					type: "footnoteDefinition",
					attrs: { label: "a b]" },
					content: [{ type: "paragraph", content: [{ type: "text", text: "x" }] }],
				},
			],
		};
		const again = parse(serialize(doc));
		expect(again.content?.[0]?.content?.[0]?.type).toBe("footnoteReference");
		expect(again.content?.[1]?.type).toBe("footnoteDefinition");
	});
});
