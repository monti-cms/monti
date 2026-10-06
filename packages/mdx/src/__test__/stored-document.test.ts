import { readStoredDocument, STORED_DOCUMENT_VERSION, type StoredDocument } from "@monti-cms/core/document";
import { describe, expect, it } from "vitest";
import { analyze } from "../analyze";
import { bodyFromDocument, bodyFromMdx, fromStoredDocument, toStoredDocument } from "../body";
import { serialize } from "../serialize";
import { readSamples } from "../testing";
import { toDocument } from "../to-document";

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

const stored = (mdx: string): StoredDocument => {
	const doc = toStoredDocument(toDocument(analyze(mdx)));
	if (!doc) throw new Error("no stored document");
	return doc;
};

describe("stored document", () => {
	it("stores a block under its definition name with only its values", () => {
		const doc = stored('<TextAlign align="center">\n\nHi\n\n</TextAlign>\n');
		expect(doc.content[0]).toEqual({
			attrs: { align: "center" },
			content: [{ content: [{ text: "Hi", type: "text" }], type: "paragraph" }],
			type: "text-align",
		});
	});

	it("keeps JSX no definition describes as raw JSX with its attribute list", () => {
		const doc = stored('A<br data-x="1" />B\n');
		const paragraph = doc.content[0];
		expect(paragraph?.content?.[1]).toEqual({
			attrs: { attributes: [{ name: "data-x", value: "1" }], name: "br" },
			type: "mdxJsx",
		});
	});

	it("drops the derived annotation document of a code block", () => {
		const doc = stored('```ts title="a.ts"\nconst a = 1;\n```\n');
		expect(doc.content[0]?.attrs).not.toHaveProperty("codeDocument");
		expect(fromStoredDocument(doc).content?.[0]?.attrs).toHaveProperty("codeDocument");
	});

	it("has no stored document for a body with front matter", () => {
		expect(toStoredDocument(toDocument(analyze("---\ntitle: A\n---\n\nHi\n")))).toBeNull();
		expect(bodyFromMdx("---\ntitle: A\n---\n\nHi\n")).toMatchObject({ doc: null, mdx: "---\ntitle: A\n---\n\nHi\n" });
	});

	it("keeps a body that does not parse as given, without a document", () => {
		const body = bodyFromMdx("<Nope>\n");
		expect(body.doc).toBeNull();
		expect(body.mdx).toBe("<Nope>\n");
	});

	it("writes the MDX from the document", () => {
		expect(bodyFromMdx("_a_ and __b__\n").mdx).toBe("*a* and **b**\n");
		expect(bodyFromMdx("Hi\n\n<br />\n").mdx).toBe("Hi\n");
	});

	it("reads only stored documents of a known version", () => {
		const doc = stored("Hi\n");
		expect(readStoredDocument(JSON.parse(JSON.stringify(doc)))).toEqual(doc);
		expect(readStoredDocument({ ...doc, version: STORED_DOCUMENT_VERSION + 1 })).toBeUndefined();
		expect(readStoredDocument({ ...doc, version: 0 })).toBeUndefined();
		expect(readStoredDocument({ ...doc, extra: 1 })).toBeUndefined();
		expect(readStoredDocument({ type: "doc", version: 1, content: [{ type: "" }] })).toBeUndefined();
		expect(readStoredDocument({ type: "doc", version: 1, content: [{ type: "text", text: 1 }] })).toBeUndefined();
		expect(readStoredDocument({ type: "doc", version: 1, content: [{ type: "text", other: 1 }] })).toBeUndefined();
		expect(readStoredDocument("Hi")).toBeUndefined();
	});

	it("round-trips every sample post: MDX → document → MDX → document, whatever the key order", () => {
		// Some samples use directive syntax, which this site does not read; `@monti-cms/syntax-directive` covers those.
		const samples = readSamples().filter(({ mdx }) => analyze(mdx).errors.length === 0);
		expect(samples.length).toBeGreaterThan(3);
		for (const { name, mdx } of samples) {
			const body = bodyFromMdx(mdx);
			expect(body.doc, name).not.toBeNull();
			const doc = body.doc as StoredDocument;
			expect(bodyFromMdx(body.mdx, undefined, { previous: doc }).doc, name).toEqual(doc);
			expect(bodyFromMdx(body.mdx).mdx, name).toBe(body.mdx);
			const reread = readStoredDocument(reorderKeys(JSON.parse(JSON.stringify(doc))));
			expect(reread, name).toBeDefined();
			const fromDoc = bodyFromDocument(reread as StoredDocument);
			expect(fromDoc.mdx, name).toBe(body.mdx);
			expect(fromDoc.doc, name).toEqual(doc);
			expect(serialize(fromStoredDocument(doc)), name).toBe(body.mdx);
		}
	});
});
