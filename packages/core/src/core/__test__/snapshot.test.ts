import { describe, expect, it } from "vitest";
import { contentCollection } from "../../../test/any-site";
import { testSite } from "../../../test/site";
import { docOf } from "../../../test/stored-content";
import { MAX_DOC_BYTES, MAX_TEXT_BYTES } from "../limits";
import { documentInputBody } from "../snapshot";
import type { ServiceInput } from "../types";

const inputWith = (doc: unknown) => ({ collection: contentCollection, slug: null, metadata: {}, doc }) as ServiceInput;
const read = (doc: unknown) => documentInputBody(testSite, inputWith(doc), null);

/** A stored document of `count` paragraphs of `words` words: big as JSON for few nodes. */
const docOfSize = (count: number, words: number) => {
	const paragraph = { type: "paragraph", content: [{ type: "text", text: "word ".repeat(words).trim() }] };
	return { type: "doc", version: 3, content: Array.from({ length: count }, () => paragraph) };
};

describe("documentInputBody", () => {
	it("WRITE-S7 refuses a value that is not a stored document as invalid_input", () => {
		const circular: Record<string, unknown> = { type: "doc", version: 3, content: [] };
		circular.self = circular;
		const notDocuments: unknown[] = [
			{ ...docOf("Body"), version: 999 },
			{ type: "doc", version: 3, content: "not a list" },
			{ type: "doc", version: 3 },
			{ type: "paragraph" },
			"text",
			42,
			null,
			[],
			circular,
		];
		for (const value of notDocuments) {
			expect(() => read(value), String(value)).toThrow(expect.objectContaining({ code: "invalid_input" }));
		}
	});

	it("WRITE-S7 refuses a document over the document limit as body_too_large, and takes one over the text limit", () => {
		const tooLarge = {
			type: "doc",
			version: 3,
			content: [{ type: "paragraph", content: [{ type: "text", text: "x".repeat(MAX_DOC_BYTES) }] }],
		};
		expect(() => read(tooLarge)).toThrow(expect.objectContaining({ code: "body_too_large" }));

		const overTextLimit = docOfSize(5_200, 72);
		const bytes = Buffer.byteLength(JSON.stringify(overTextLimit));
		expect(bytes).toBeGreaterThan(MAX_TEXT_BYTES);
		expect(bytes).toBeLessThan(MAX_DOC_BYTES);
		expect(read(overTextLimit).doc.content).toHaveLength(5_200);
	});
});
