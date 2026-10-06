// The format module loads the site config before the document model reads its blocks.
import "../format";
import { isUnparsedDocument, withoutBlockIds } from "@monti-cms/core/document";
import { describe, expect, it } from "vitest";
import { bodyFromDocument, bodyFromMdx } from "../body";
import { createMdxFormat } from "../format";
import { createServerMdxFormat, legacyBodies } from "../server";
import { insertSoftBreaks } from "../soft-breaks";
import type { SyntaxExtension } from "../syntax";
import { docOfMdx } from "../testing";

/** A made-up notation for a mark: `{u text}` is underlined text. It is written and read only while the extension is listed. */
const braces: SyntaxExtension = {
	name: "braces",
	fromMark: { underline: (_mark, inner) => `{u ${inner}}` },
};

const SOURCES = [
	"# Title\n\nFirst *paragraph* with a [link](https://example.com).\n",
	"- one\n- two\n\n> quoted\n",
	"A line\nand its soft ending\n",
	"```ts\nconst a = 1;\n```\n",
	"Words\n\n<Unclosed",
];

describe("legacyBodies", () => {
	const bodies = legacyBodies();

	describe("read", () => {
		it("returns the text and the document of bodyFromMdx", () => {
			for (const source of SOURCES) {
				const expected = bodyFromMdx(source);
				const read = bodies.read(source);
				expect(read.text, source).toBe(expected.mdx);
				expect(read.doc === null, source).toBe(expected.doc === null);
				if (expected.doc && read.doc) {
					expect(withoutBlockIds(read.doc.content)).toEqual(withoutBlockIds(expected.doc.content));
				}
			}
		});

		it("gives a text that does not read no document, and keeps the text as it was given", () => {
			const read = bodies.read("Words\n\n<Unclosed");
			expect(read.doc).toBeNull();
			expect(read.text).toBe("Words\n\n<Unclosed");
		});

		it("lets blocks inherit the ids of the previous document", () => {
			const previous = docOfMdx("First\n\nSecond\n");
			const read = bodies.read("First\n\nSecond\n", { previous });
			expect(read.doc?.content.map((block) => block.id)).toEqual(previous.content.map((block) => block.id));
		});

		it("writes with the syntax extensions it was given", () => {
			const withBraces = legacyBodies({ syntax: [braces] });
			const doc = docOfMdx("A word", [braces]);
			const marked = {
				...doc,
				content: [{ type: "paragraph", content: [{ type: "text", text: "word", marks: [{ type: "underline" }] }] }],
			};
			const written = withBraces.write(marked);
			expect(written.text).toBe(bodyFromDocument(marked, [braces]).mdx);
			expect(written.text).toContain("{u word}");
			expect(bodies.write(marked).text).not.toContain("{u word}");
		});
	});

	describe("write", () => {
		it("returns the text and the document of bodyFromDocument", () => {
			for (const source of SOURCES.filter((entry) => !entry.includes("<Unclosed"))) {
				const doc = docOfMdx(source);
				const expected = bodyFromDocument(doc);
				const written = bodies.write(doc);
				expect(written.text, source).toBe(expected.mdx);
				expect(written.doc?.content, source).toEqual(expected.doc?.content);
			}
		});

		it("keeps the block ids of the document it is given", () => {
			const doc = docOfMdx("First\n\nSecond\n");
			const written = bodies.write(doc);
			expect(written.doc?.content.map((block) => block.id)).toEqual(doc.content.map((block) => block.id));
		});

		it("gives the same result as reading the text it wrote", () => {
			const doc = docOfMdx("# Title\n\nA *word*.\n");
			const written = bodies.write(doc);
			const reread = bodies.read(written.text, { previous: doc });
			expect(reread.text).toBe(written.text);
			expect(reread.doc?.content).toEqual(written.doc?.content);
		});
	});

	describe("insertSoftBreaks", () => {
		it("maps a change to the new text", () => {
			const source = "A line\nand its soft ending\n";
			const expected = insertSoftBreaks(source);
			expect(expected.status).toBe("changed");
			expect(bodies.insertSoftBreaks(source)).toEqual({
				status: "changed",
				text: expected.status === "changed" ? expected.mdx : "",
			});
		});

		it("maps a text without a soft ending to unchanged", () => {
			expect(bodies.insertSoftBreaks("One line only\n")).toEqual({ status: "unchanged" });
		});

		it("maps a text it cannot edit to skipped, with the reason", () => {
			const source = "A line\n<Unclosed";
			const expected = insertSoftBreaks(source);
			expect(expected.status).toBe("skipped");
			const result = bodies.insertSoftBreaks(source);
			expect(result.status).toBe("skipped");
			if (result.status === "skipped" && expected.status === "skipped") {
				expect(result.reason).toBe(expected.reason);
				expect(result.detail).toBe(expected.detail);
			}
		});

		it("is a no-op the second time", () => {
			const first = bodies.insertSoftBreaks("A line\nand another\n");
			if (first.status !== "changed") throw new Error("expected a change");
			expect(bodies.insertSoftBreaks(first.text)).toEqual({ status: "unchanged" });
		});
	});

	describe("documentOf", () => {
		it("gives the stored document of a text that reads", () => {
			const doc = bodies.documentOf("# Title\n\nWords\n");
			expect(isUnparsedDocument(doc)).toBe(false);
			expect(doc.content.map((block) => block.type)).toEqual(["heading", "paragraph"]);
		});

		it("gives an unparsed document holding the text for a text that does not read", () => {
			const broken = "Words\n\n<Unclosed";
			const doc = bodies.documentOf(broken);
			expect(isUnparsedDocument(doc)).toBe(true);
			expect(doc.content[0]).toMatchObject({ type: "unparsed", attrs: { source: broken } });
		});

		it("gives an unparsed document for a text with front matter", () => {
			expect(isUnparsedDocument(bodies.documentOf("---\ntitle: x\n---\n\nBody"))).toBe(true);
		});
	});
});

describe("createServerMdxFormat", () => {
	it("keeps what the mdx format is and adds the old-body reader", () => {
		const plain = createMdxFormat();
		const server = createServerMdxFormat();
		expect(server).toMatchObject({
			name: plain.name,
			label: plain.label,
			mimeType: plain.mimeType,
			extension: plain.extension,
		});
		expect(plain.legacyBodies).toBeUndefined();
		expect(server.legacyBodies).toBeDefined();
		expect(typeof server.legacyBodies?.read).toBe("function");
	});

	it("reads and writes like the plain format", async () => {
		const server = createServerMdxFormat();
		const doc = docOfMdx("# Title\n\nSome *words*\n");
		const ctx = {
			locale: "ko",
			blocks: (await import("../syntax-config")).siteSyntaxBlocks,
			codeLineEffects: (await import("../syntax-config")).siteCodeLineEffects,
		};
		const exportContext = {
			...ctx,
			purpose: "read" as const,
			link: () => null,
			media: () => null,
			report: () => {},
		};
		expect(await server.export(doc, exportContext)).toBe(await createMdxFormat().export(doc, exportContext));
		const text = "# Title\n\nSome *words*\n";
		expect(await server.import?.(text, ctx)).toEqual(await createMdxFormat().import?.(text, ctx));
	});

	it("passes its syntax extensions to the format and to the old-body reader", async () => {
		const server = createServerMdxFormat({ syntax: [braces] });
		const doc = {
			...docOfMdx("x"),
			content: [{ type: "paragraph", content: [{ type: "text", text: "word", marks: [{ type: "underline" }] }] }],
		};
		const syntaxCtx = (await import("../syntax-config")).siteSyntaxBlocks;
		const text = await server.export(doc, {
			locale: "ko",
			blocks: syntaxCtx,
			codeLineEffects: new Set(),
			purpose: "read",
			link: () => null,
			media: () => null,
			report: () => {},
		});
		expect(text).toContain("{u word}");
		expect(server.legacyBodies?.write(doc).text).toContain("{u word}");
	});
});
