import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { docOf } from "../../../test/stored-content";
import { STORED_DOCUMENT_VERSION, type StoredDocument, unparsedDocument } from "../../doc/stored-document";
import type { CmsJsonValue, CmsNode } from "../../doc/types";
import { computeContentHash } from "../content-hash";

const metadata = { title: "A" };
/** The hash of a body written as plain text (see `test/doc-text.ts`). */
const hashOf = (text: string, meta: Record<string, unknown> = metadata) =>
	computeContentHash(meta as never, docOf(text));

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
		it("WRITE-S3 attributes listed in a different order", () => {
			const a = documentOf(block({ tone: "info", width: 50 }));
			const b = documentOf(block({ width: 50, tone: "info" }));
			expect(computeContentHash(metadata, a)).toBe(computeContentHash(metadata, b));
		});

		it("WRITE-S3 a document of another version, because the version only changes how a link is written", () => {
			const doc = docOf("Hello");
			expect(computeContentHash(metadata, { ...doc, version: STORED_DOCUMENT_VERSION + 1 })).toBe(
				computeContentHash(metadata, doc),
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

		it("WRITE-S3 an attribute value change", () => {
			const hash = (tone: string) => computeContentHash(metadata, documentOf(block({ tone })));
			expect(hash("info")).not.toBe(hash("warning"));
		});

		it("WRITE-S3 the code of a code block", () => {
			expect(hashOf("```ts\nconst a = 1\n```")).not.toBe(hashOf("```ts\nconst a = 2\n```"));
		});

		it("WRITE-S3 the language of a code block, with the same code", () => {
			expect(hashOf("```ts\nconst a = 1\n```")).not.toBe(hashOf("```js\nconst a = 1\n```"));
		});

		it("metadata", () => {
			expect(hashOf("Hello", { title: "B" })).not.toBe(hashOf("Hello"));
		});
	});

	describe("a body that could not be read", () => {
		const broken = "<<<Open\n";
		const unparsed = unparsedDocument(broken, null, "paragraphs");

		it("WRITE-S3 is hashed from the raw string, tagged so it never collides with a parsed body", () => {
			const expected = createHash("sha256")
				.update(JSON.stringify(["cms-snapshot-v3-raw", 1, metadata, broken]))
				.digest("hex");
			expect(computeContentHash(metadata, unparsed)).toBe(expected);
		});
	});
});
