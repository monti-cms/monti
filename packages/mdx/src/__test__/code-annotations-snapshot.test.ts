import { describe, expect, it } from "vitest";
import { contentCollection } from "../../../test/any-site";
import { docOf, mdxOf } from "../../../test/stored-content";
import { prepareSnapshot } from "../snapshot";

const CODE = ["const a = 1;", "const b = 2;", "const c = 3;", "const d = 4;", "const e = 5;"];
const fence = (lines: string[]) => `\`\`\`ts\n${lines.join("\n")}\n\`\`\`\n`;

const stacked = fence([
	"// @line plus {0-1}",
	"// @line minus {1-2}",
	"// @line warning {2-3}",
	"// @line error {3-4}",
	...CODE,
]);
const perLine = fence([
	"// @line plus {0-1}",
	CODE[0] as string,
	CODE[1] as string,
	"// @line minus {2-2}",
	CODE[2] as string,
	"// @line warning {3-3}",
	CODE[3] as string,
	CODE[4] as string,
]);
// Ranges that reach past the last code line: the lines they cover are the ones the code has.
const pastTheEnd = fence(["// @line plus {3-9}", "// @line minus {7-9}", "// @line warning {0-1}", ...CODE]);

const prepare = (input: { body: string; format: string } | { doc: unknown }) =>
	prepareSnapshot({ collection: contentCollection, slug: "code", metadata: { title: "Code" }, ...input });

describe.each([
	["stacked ranged annotations", stacked],
	["ranged annotations above their own lines", perLine],
	["ranged annotations that reach past the code", pastTheEnd],
])("code with %s", (_name, mdx) => {
	it("is read as a document, not an unparsed body", async () => {
		const snapshot = await prepare({ body: mdx, format: "mdx" });
		expect(snapshot.doc.content.map((node) => node.type)).toEqual(["codeBlock"]);
		expect(snapshot.issues.map((issue) => issue.code)).not.toContain("unparsed_body");
	});

	it("keeps its annotations and the code without the annotation comments", async () => {
		const attrs = (await prepare({ body: mdx, format: "mdx" })).doc.content[0]?.attrs as {
			code: string;
			annotations: { lines: { name: string; start: number; end: number }[] };
		};
		expect(attrs.code).toBe(CODE.join("\n"));
		expect(attrs.annotations.lines.length).toBeGreaterThan(0);
		for (const line of attrs.annotations.lines) {
			expect(line.start).toBeLessThan(CODE.length);
			expect(line.end).toBeLessThanOrEqual(CODE.length);
		}
	});

	it("has the same content hash when the document is sent back, and when the text it was written as is saved again", async () => {
		const first = await prepare({ body: mdx, format: "mdx" });
		const fromDocument = await prepare({ doc: first.doc });
		const written = mdxOf(first.doc);
		const fromWritten = await prepare({ format: "mdx", body: written });
		expect(fromDocument.contentHash).toBe(first.contentHash);
		expect(fromWritten.contentHash).toBe(first.contentHash);
		expect(mdxOf(fromWritten.doc)).toBe(written);
	});

	it("is stored as a document with the annotations", () => {
		const doc = docOf(mdx);
		expect(doc?.content[0]?.type).toBe("codeBlock");
	});
});

describe("code annotations the text cannot keep", () => {
	it("drops an annotation that starts past the last code line, and keeps the others", async () => {
		const attrs = (await prepare({ format: "mdx", body: pastTheEnd })).doc.content[0]?.attrs as {
			annotations: { lines: { name: string; start: number; end: number }[] };
		};
		expect(attrs.annotations.lines.map((line) => line.name).sort()).toEqual(["plus", "warning"]);
		expect(attrs.annotations.lines.find((line) => line.name === "plus")).toMatchObject({ start: 3, end: CODE.length });
	});

	it("warns about each one (not an error), with the block, so the body still saves and publishes", async () => {
		const snapshot = await prepare({ format: "mdx", body: pastTheEnd });
		const block = snapshot.doc.content[0]?.id;
		expect(block).toBeDefined();
		const warnings = (snapshot.warnings ?? []).filter((warning) => warning.code === "code_annotation_out_of_range");
		expect(warnings.map((warning) => warning.message).sort()).toEqual(["minus", "plus"]);
		for (const warning of warnings) expect(warning.position).toEqual({ blockId: block });
		expect(snapshot.issues).toEqual([]);
	});

	it("does not warn about annotations that stay in the code", async () => {
		for (const mdx of [stacked, perLine]) {
			const snapshot = await prepare({ body: mdx, format: "mdx" });
			expect((snapshot.warnings ?? []).map((warning) => warning.code)).not.toContain("code_annotation_out_of_range");
		}
	});

	it("still makes a body unparsed when it does not parse", async () => {
		const snapshot = await prepare({ format: "mdx", body: "<Open\n" });
		expect(snapshot.doc.content[0]?.type).toBe("unparsed");
		expect(snapshot.issues.map((issue) => issue.code)).toContain("unparsed_body");
	});
});
