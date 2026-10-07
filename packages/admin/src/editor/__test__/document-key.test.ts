import { STORED_DOCUMENT_VERSION, type StoredDocument } from "@monti-cms/core/document";
import { describe, expect, it } from "vitest";
import { testSite } from "../../../../core/test/site";
import { docOf } from "../../test/mdx";
import { documentKey } from "../document-key";

const doc = (...content: StoredDocument["content"]): StoredDocument => ({
	type: "doc",
	version: STORED_DOCUMENT_VERSION,
	content,
});

describe("documentKey", () => {
	it("is the same for the same words whatever the block ids", () => {
		expect(documentKey(testSite, docOf("문단\n\n- 하나\n- 둘\n"))).toBe(
			documentKey(testSite, docOf("문단\n\n- 하나\n- 둘\n")),
		);
	});

	it("is not the same for other words, other kinds of block or other attributes", () => {
		const base = documentKey(testSite, docOf("문단"));
		expect(documentKey(testSite, docOf("다른 문단"))).not.toBe(base);
		expect(documentKey(testSite, docOf("## 문단"))).not.toBe(base);
		expect(documentKey(testSite, docOf("## 문단"))).not.toBe(documentKey(testSite, docOf("### 문단")));
	});

	it("does not see the order of keys, which Postgres does not keep", () => {
		const a = doc({ type: "heading", attrs: { level: 2, textAlign: "left" }, content: [{ type: "text", text: "가" }] });
		const b = doc({ content: [{ text: "가", type: "text" }], attrs: { textAlign: "left", level: 2 }, type: "heading" });
		expect(documentKey(testSite, a)).toBe(documentKey(testSite, b));
	});

	it("does not see what does not change what a body says: trailing empty paragraphs and how text is split into runs", () => {
		const plain = doc({ type: "paragraph", content: [{ type: "text", text: "가나" }] });
		const split = doc(
			{
				type: "paragraph",
				content: [
					{ type: "text", text: "가" },
					{ type: "text", text: "나" },
				],
			},
			{ type: "paragraph" },
		);
		expect(documentKey(testSite, split)).toBe(documentKey(testSite, plain));
	});

	it("is worked out once for a document", () => {
		const one = docOf("문단");
		expect(documentKey(testSite, one)).toBe(documentKey(testSite, one));
	});
});
