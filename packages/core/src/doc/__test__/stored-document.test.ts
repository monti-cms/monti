import { describe, expect, it } from "vitest";
import { docOf } from "../../../test/stored-content";
import {
	canonicalDocument,
	isUnparsedDocument,
	readStoredDocument,
	STORED_DOCUMENT_VERSION,
	type StoredDocument,
	unparsedDocument,
} from "../stored-document";

/** Postgres `jsonb` does not keep key order. Reversing every object's keys is the worst case. */
const reorderKeys = (value: unknown): unknown => {
	if (Array.isArray(value)) return value.map(reorderKeys);
	if (value === null || typeof value !== "object") return value;
	return Object.fromEntries(
		Object.keys(value)
			.reverse()
			.map((key) => [key, reorderKeys((value as Record<string, unknown>)[key])]),
	);
};

/** The model of a stored document. How a text becomes one (and back) belongs to a format, and `@monti-cms/mdx` tests the MDX one. */
describe("stored document", () => {
	it("reads only stored documents of a known version", () => {
		const doc = docOf("Hi\n");
		expect(readStoredDocument(JSON.parse(JSON.stringify(doc)))).toEqual(doc);
		expect(readStoredDocument({ ...doc, version: STORED_DOCUMENT_VERSION + 1 })).toBeUndefined();
		expect(readStoredDocument({ ...doc, version: 0 })).toBeUndefined();
		expect(readStoredDocument({ ...doc, extra: 1 })).toBeUndefined();
		expect(readStoredDocument({ type: "doc", version: 1, content: [{ type: "" }] })).toBeUndefined();
		expect(readStoredDocument({ type: "doc", version: 1, content: [{ type: "text", text: 1 }] })).toBeUndefined();
		expect(readStoredDocument({ type: "doc", version: 1, content: [{ type: "text", other: 1 }] })).toBeUndefined();
		expect(readStoredDocument("Hi")).toBeUndefined();
	});

	it("reads the same document whatever the key order of the stored value", () => {
		const doc = docOf(
			'# Title\n\nSome **bold** and a [link](https://example.com).\n\n- one\n- two\n\n```ts title="a.ts"\nconst a = 1;\n```\n',
		);

		const reread = readStoredDocument(reorderKeys(JSON.parse(JSON.stringify(doc))));

		expect(reread).toEqual(doc);
		expect(canonicalDocument(reread as StoredDocument)).toEqual(doc);
	});

	it("keeps a text no format could read as an unparsed document, and knows it", () => {
		const doc = unparsedDocument("Words <Open", null, "paragraphs");

		expect(doc.content).toEqual([
			expect.objectContaining({ type: "unparsed", attrs: { format: "paragraphs", source: "Words <Open" } }),
		]);
		expect(isUnparsedDocument(doc)).toBe(true);
		expect(isUnparsedDocument(docOf("Words\n"))).toBe(false);
	});
});
