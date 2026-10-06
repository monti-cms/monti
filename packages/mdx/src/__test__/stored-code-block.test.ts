import {
	type CmsNode,
	readStoredDocument,
	type StoredDocument,
	storedCodeBlockFence,
	withoutBlockIds,
} from "@monti-cms/core/document";
import { describe, expect, it } from "vitest";
import { bodyFromDocument, bodyFromMdx, fromStoredDocument } from "../body";

const FENCE = [
	'```ts title="a.ts"',
	"// @line plus",
	"const a = 1;",
	"// @char strong {6-6}",
	"const b = 2;",
	"// @document fold {re:/old/g}",
	"const old = 3;",
	'// @line anchor {3-3} id="c1"',
	"return a + b;",
	"```",
	"",
].join("\n");

const codeBlockOf = (doc: StoredDocument | null): CmsNode => {
	const block = doc?.content.find((node) => node.type === "codeBlock");
	if (!block) throw new Error("no code block");
	return block;
};

describe("a stored code block", () => {
	it("holds its code without the annotation comments, and the annotations as data", () => {
		const block = codeBlockOf(bodyFromMdx(FENCE).doc);
		expect(block.attrs?.code).toBe(["const a = 1;", "const b = 2;", "const old = 3;", "return a + b;"].join("\n"));
		expect(block.attrs).not.toHaveProperty("value");
		expect(block.attrs).not.toHaveProperty("codeDocument");
		expect(block.attrs).not.toHaveProperty("title");
		expect(block.attrs?.meta).toBe('title="a.ts"');
		// Line ranges are [start, end) over code lines; text offsets are into the whole code, as the parser keeps them.
		expect(block.attrs?.annotations).toEqual({
			lines: expect.arrayContaining([
				{ name: "plus", start: 0, end: 1 },
				{ name: "anchor", start: 3, end: 4, attrs: { id: "c1" } },
			]),
			text: [{ line: 1, scope: "char", name: "strong", start: 19, end: 20 }],
			rules: [{ scope: "document", name: "fold", pattern: "old", flags: "g" }],
		});
	});

	it("writes the annotations back as Monti comments and reads them back to the same data", () => {
		const body = bodyFromMdx(FENCE);
		expect(body.mdx).toContain("// @line plus");
		expect(body.mdx).toContain('id="c1"');
		expect(body.mdx).toContain("{re:/old/g}");
		const again = bodyFromMdx(body.mdx, undefined, { previous: body.doc });
		expect(again.mdx).toBe(body.mdx);
		expect(again.doc).toEqual(body.doc);
		expect(bodyFromDocument(body.doc as StoredDocument).mdx).toBe(body.mdx);
	});

	it("gives the working document the fence text, the parsed annotations and the meta keys again", () => {
		const working = fromStoredDocument(bodyFromMdx(FENCE).doc as StoredDocument);
		const block = working.content?.find((node) => node.type === "codeBlock");
		expect(block?.attrs?.value).toContain("// @line plus");
		expect(block?.attrs).toHaveProperty("codeDocument");
		expect(block?.attrs?.title).toBe("a.ts");
	});

	it("keeps a plain code block plain", () => {
		const block = codeBlockOf(bodyFromMdx("```js\nconsole.log(1);\n```\n").doc);
		expect(block.attrs).toEqual({ code: "console.log(1);", language: "js", meta: "" });
	});

	it("keeps a comment line that is not an annotation as code", () => {
		const block = codeBlockOf(bodyFromMdx("```ts\n// @nope plus\nx();\n```\n").doc);
		expect(block.attrs?.code).toBe("// @nope plus\nx();");
		expect(block.attrs).not.toHaveProperty("annotations");
	});

	it("writes a text range on a later line where it was, even when its offset into the code is small enough to fit that line", () => {
		// The first line is short, so the offsets of the second line's range (4-9) also fit inside the second line.
		const fence = ["```ts", "abc", "// @char strong {0-4}", "const item = 1;", "```", ""].join("\n");
		const body = bodyFromMdx(fence);
		const block = codeBlockOf(body.doc);
		expect(block.attrs?.annotations).toEqual({ text: [{ line: 1, scope: "char", name: "strong", start: 4, end: 9 }] });
		expect(body.mdx).toContain("// @char strong {0-4}\nconst item = 1;");
		const again = bodyFromMdx(body.mdx, undefined, { previous: body.doc });
		expect(again.doc).toEqual(body.doc);
		expect(storedCodeBlockFence(block.attrs ?? {})).toBe("abc\n// @char strong {0-4}\nconst item = 1;");
	});

	it("lifts a version 1 document, whose code block held the fence text, to the current form", () => {
		const current = bodyFromMdx(FENCE).doc as StoredDocument;
		const block = codeBlockOf(current);
		const version1 = {
			type: "doc",
			version: 1,
			content: [
				{
					type: "codeBlock",
					id: block.id,
					attrs: {
						language: "ts",
						meta: 'title="a.ts"',
						title: "a.ts",
						value: FENCE.split("\n").slice(1, -2).join("\n"),
					},
				},
			],
		};
		const lifted = readStoredDocument(version1);
		expect(lifted?.version).toBe(current.version);
		expect(withoutBlockIds(lifted?.content ?? [])).toEqual(withoutBlockIds(current.content));
	});
});
