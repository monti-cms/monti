import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { docOf } from "../../../test/stored-content";
import { STORED_DOCUMENT_VERSION, type StoredDocument, unparsedDocument } from "../../doc/stored-document";
import type { CmsJsonValue, CmsNode } from "../../doc/types";
import { canonicalBodyForHash, computeContentHash } from "../content-hash";

const metadata = { title: "A" };
/** The hash of a body written as plain text (see `test/doc-text.ts`). */
const hashOf = (text: string, meta: Record<string, unknown> = metadata, schemaVersion = 1) =>
	computeContentHash(meta as never, docOf(text), schemaVersion);

const documentOf = (...content: CmsNode[]): StoredDocument => ({
	type: "doc",
	version: STORED_DOCUMENT_VERSION,
	content,
});

/** A block with attributes, which the text reader cannot say. Its name and attributes mean nothing to the hash: any block is hashed alike. */
const block = (attrs: Record<string, CmsJsonValue>, text = "Inside"): CmsNode => ({
	type: "callout",
	attrs,
	content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

describe("content hash v2", () => {
	describe("equivalent bodies hash equally", () => {
		it("emphasis written with asterisks or underscores", () => {
			expect(hashOf("An *a* word")).toBe(hashOf("An _a_ word"));
		});

		it("attributes listed in a different order", () => {
			const a = documentOf(block({ tone: "info", width: 50 }));
			const b = documentOf(block({ width: 50, tone: "info" }));
			expect(computeContentHash(metadata, a)).toBe(computeContentHash(metadata, b));
		});

		it("blocks that differ only by their ids", () => {
			const a = documentOf({ ...block({ tone: "info" }), id: "aaaaaaaa" });
			const b = documentOf({ ...block({ tone: "info" }), id: "bbbbbbbb" });
			expect(computeContentHash(metadata, a)).toBe(computeContentHash(metadata, b));
		});

		it("metadata keys in a different order", () => {
			expect(hashOf("Hello", { title: "A", summary: "B" })).toBe(hashOf("Hello", { summary: "B", title: "A" }));
		});

		it("a document of another version, because the version only changes how a link is written", () => {
			const doc = docOf("Hello");
			expect(computeContentHash(metadata, { ...doc, version: STORED_DOCUMENT_VERSION + 1 })).toBe(
				computeContentHash(metadata, doc),
			);
		});

		it("is deterministic", () => {
			expect(computeContentHash(metadata, documentOf(block({ tone: "info" })))).toBe(
				computeContentHash(metadata, documentOf(block({ tone: "info" }))),
			);
		});
	});

	describe("content changes hash differently", () => {
		const base = "An *a* word";
		it.each([
			["a text change", "An *b* word"],
			["a mark change", "An **a** word"],
			["a block change", "# An *a* word"],
		])("%s", (_name, changed) => {
			expect(hashOf(changed)).not.toBe(hashOf(base));
		});

		it("an attribute value change", () => {
			const hash = (tone: string) => computeContentHash(metadata, documentOf(block({ tone })));
			expect(hash("info")).not.toBe(hash("warning"));
		});

		it("the code of a code block", () => {
			expect(hashOf("```ts\nconst a = 1\n```")).not.toBe(hashOf("```ts\nconst a = 2\n```"));
		});

		it("metadata and schema version", () => {
			expect(hashOf("Hello", { title: "B" })).not.toBe(hashOf("Hello"));
			expect(hashOf("Hello", metadata, 2)).not.toBe(hashOf("Hello", metadata, 1));
		});
	});

	describe("a body that could not be read", () => {
		const broken = "<<<Open\n";
		const unparsed = unparsedDocument(broken, null, "paragraphs");

		it("is hashed from the raw string, tagged so it never collides with a parsed body", () => {
			const expected = createHash("sha256")
				.update(JSON.stringify(["cms-snapshot-v3-raw", 1, metadata, broken]))
				.digest("hex");
			expect(computeContentHash(metadata, unparsed)).toBe(expected);
		});

		it("is stable and distinct per raw string", () => {
			expect(computeContentHash(metadata, unparsed)).toBe(computeContentHash(metadata, unparsedDocument(broken)));
			expect(computeContentHash(metadata, unparsedDocument(`${broken}more`))).not.toBe(
				computeContentHash(metadata, unparsed),
			);
		});
	});

	describe("canonicalBodyForHash", () => {
		it("leaves the block ids out and sorts the attribute keys at every depth", () => {
			const json = JSON.stringify(canonicalBodyForHash(documentOf({ ...block({ b: 1, a: 2 }), id: "aaaaaaaa" })));
			expect(json).not.toContain("aaaaaaaa");
			expect(json.indexOf('"a":2')).toBeLessThan(json.indexOf('"b":1'));
		});

		it("keeps the code and its language", () => {
			const json = JSON.stringify(canonicalBodyForHash(docOf('```ts title="a"\nconst a = 1\n```')));
			expect(json).toContain("const a = 1");
			expect(json).toContain('"language":"ts"');
		});

		it("does not change the document it receives", () => {
			const document = documentOf({ ...block({ tone: "info" }), id: "aaaaaaaa" });
			const before = JSON.stringify(document);
			canonicalBodyForHash(document);
			expect(JSON.stringify(document)).toBe(before);
		});
	});
});
