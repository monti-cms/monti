import { describe, expect, it } from "vitest";
import { analyze } from "../analyze";
import { forEachBlock } from "../block-ids";
import { blockSpansOf } from "../block-spans";
import { bodyFromMdx } from "../stored-document";
import { type BlockSources, toDocument } from "../to-document";
import type { CmsNode } from "../types";

const textOf = (node: CmsNode): string => (node.text ?? "") + (node.content ?? []).map(textOf).join("");

/** The block (as `type: text`) the first occurrence of `needle` in the stored MDX is in, or `undefined` for a place no block holds. */
const blockAt = (mdx: string, needle: string, from = 0): string | undefined => {
	const body = bodyFromMdx(mdx);
	if (!body.doc) throw new Error("no document");
	const offset = body.mdx.indexOf(needle, from);
	if (offset < 0) throw new Error(`"${needle}" is not in the stored MDX:\n${body.mdx}`);
	const id = blockSpansOf(body.analysis, body.doc).blockIdAt(offset);
	if (id === undefined) return undefined;
	let found: string | undefined;
	forEachBlock(body.doc.content, (block) => {
		if (block.id === id) found = `${block.type}: ${textOf(block)}`;
	});
	return found;
};

describe("block spans", () => {
	it("maps text of a paragraph and a heading to that block", () => {
		const mdx = "# Title here\n\nFirst **bold** paragraph.\n\nSecond one.\n";
		expect(blockAt(mdx, "Title")).toBe("heading: Title here");
		expect(blockAt(mdx, "bold")).toBe("paragraph: First bold paragraph.");
		expect(blockAt(mdx, "Second")).toBe("paragraph: Second one.");
	});

	it("gives a place between blocks no block", () => {
		const mdx = "One\n\nTwo\n";
		const body = bodyFromMdx(mdx);
		const offset = body.mdx.indexOf("\n\n") + 1;
		expect(blockSpansOf(body.analysis, body.doc).blockIdAt(offset)).toBeUndefined();
	});

	it("maps a list item's text to its paragraph and its marker to the list item", () => {
		const mdx = "- outer one\n  - inner two\n- outer three\n";
		expect(blockAt(mdx, "outer one")).toBe("paragraph: outer one");
		expect(blockAt(mdx, "inner two")).toBe("paragraph: inner two");
		expect(blockAt(mdx, "- inner")).toBe("listItem: inner two");
		expect(blockAt(mdx, "- outer one")).toBe("listItem: outer oneinner two");
		expect(blockAt(mdx, "- outer three")).toBe("listItem: outer three");
	});

	it("maps text in a table cell to the cell, in a GFM table and in a Table element", () => {
		const gfm = "| a | b |\n| - | - |\n| one | two |\n";
		expect(blockAt(gfm, "two")).toBe("tableCell: two");
		expect(blockAt(gfm, "one")).toBe("tableCell: one");
		expect(blockAt(gfm, "a")).toBe("tableCell: a");
		const merged =
			'<Table>\n<TableRow>\n<TableCell colspan="2">wide</TableCell>\n</TableRow>\n<TableRow>\n<TableCell>left</TableCell>\n<TableCell>right</TableCell>\n</TableRow>\n</Table>\n';
		expect(blockAt(merged, "wide")).toBe("tableCell: wide");
		expect(blockAt(merged, "right")).toBe("tableCell: right");
		expect(blockAt(merged, "<TableRow>")).toBe("tableRow: wide");
		expect(blockAt(merged, "<Table>")).toBe("table: wideleftright");
	});

	it("maps a custom block and its inner paragraph apart", () => {
		const mdx = '<TextAlign align="center">\n\nInside text.\n\n</TextAlign>\n\nAfter.\n';
		expect(blockAt(mdx, "<TextAlign")).toBe("text-align: Inside text.");
		expect(blockAt(mdx, "Inside")).toBe("paragraph: Inside text.");
		expect(blockAt(mdx, "After")).toBe("paragraph: After.");
	});

	it("maps a code block's lines to the code block", () => {
		const mdx = "Before.\n\n```ts\nconst a = 1;\nconst b = 2;\n```\n";
		expect(blockAt(mdx, "const b")).toBe("codeBlock: ");
		expect(blockAt(mdx, "```ts")).toBe("codeBlock: ");
	});

	it("maps each part of a paragraph split around block JSX to its own block", () => {
		const mdx = 'Lead text <Image mediaId="00000000-0000-4000-8000-000000000001" alt="x" /> trailing text\n';
		const body = bodyFromMdx(mdx);
		expect(body.doc?.content.map((block) => block.type)).toEqual(["paragraph", "image", "paragraph"]);
		expect(blockAt(mdx, "Lead")).toBe("paragraph: Lead text");
		expect(blockAt(mdx, "<Image")).toBe("image: ");
		expect(blockAt(mdx, "trailing")).toBe("paragraph:  trailing text");
	});

	it("maps each blank line of a line-break-only paragraph to its own block", () => {
		const mdx = "One\n\n<br />\n\n<br />\n\nTwo\n";
		const body = bodyFromMdx(mdx);
		const types = body.doc?.content.map((block) => block.type);
		expect(types).toEqual(["paragraph", "paragraph", "paragraph", "paragraph"]);
		const first = blockAt(mdx, "<br />");
		const second = blockAt(mdx, "<br />", body.mdx.indexOf("<br />") + 1);
		expect(first).toBe("paragraph: ");
		expect(second).toBe("paragraph: ");
		expect(blockAt(mdx, "Two")).toBe("paragraph: Two");
	});

	it("maps footnote definitions and the paragraph inside them", () => {
		const mdx = "Text[^1] here.\n\n[^1]: The note.\n";
		expect(blockAt(mdx, "Text")).toBe("paragraph: Text here.");
		expect(blockAt(mdx, "[^1]:")).toBe("footnoteDefinition: The note.");
		expect(blockAt(mdx, "The note")).toBe("paragraph: The note.");
	});

	it("maps a Markdown image and an Image element to the image block", () => {
		const mdx =
			'![alt text](https://example.com/a.png)\n\ntext ![inline](https://example.com/b.png) more\n\n<Image mediaId="00000000-0000-4000-8000-000000000001" alt="c" />\n';
		const body = bodyFromMdx(mdx);
		expect(body.doc?.content.map((block) => block.type)).toEqual(["image", "paragraph", "image"]);
		expect(blockAt(mdx, "![alt text]")).toBe("image: ");
		// An image inside text is part of that paragraph.
		expect(blockAt(mdx, "![inline]")).toBe("paragraph: text  more");
		expect(blockAt(mdx, "<Image")).toBe("image: ");
	});

	it("maps a place in a blockquote to the innermost block", () => {
		const mdx = "> quoted text\n\nafter\n";
		expect(blockAt(mdx, "quoted")).toBe("paragraph: quoted text");
		expect(blockAt(mdx, "> quoted")).toBe("blockquote: quoted text");
	});

	it("has no blocks for a body without a document", () => {
		const frontmatter = bodyFromMdx("---\ntitle: x\n---\n\nText\n");
		expect(frontmatter.doc).toBeNull();
		expect(
			blockSpansOf(frontmatter.analysis, frontmatter.doc).blockIdAt(frontmatter.mdx.indexOf("Text")),
		).toBeUndefined();
		const broken = bodyFromMdx("<Callout>\n\nText\n");
		expect(broken.doc).toBeNull();
		expect(blockSpansOf(broken.analysis, broken.doc).blockIdAt(5)).toBeUndefined();
	});

	it("pairs the stored blocks with the parsed ones when trailing blank lines are not stored", () => {
		const mdx = "Text\n\n<br />\n\n<br />\n";
		const body = bodyFromMdx(mdx);
		expect(body.doc?.content.map((block) => block.type)).toEqual(["paragraph"]);
		expect(blockAt(mdx, "Text")).toBe("paragraph: Text");
	});

	it("does not change what toDocument returns", () => {
		const analysis = analyze(
			'# T\n\n- a\n- b\n\n| x |\n| - |\n| y |\n\n<TextAlign align="center">\n\nIn\n\n</TextAlign>\n',
		);
		const sources: BlockSources = [];
		expect(toDocument(analysis, sources)).toEqual(toDocument(analysis));
		expect(sources.length).toBeGreaterThan(0);
	});
});
