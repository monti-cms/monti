import { describe, expect, it } from "vitest";
import { STORED_DOCUMENT_VERSION, type StoredDocument } from "../../../doc/stored-document";
import type { CmsNode } from "../../../doc/types";
import { analyzeDocument } from "../analyze";

const doc = (...content: CmsNode[]): StoredDocument => ({ type: "doc", version: STORED_DOCUMENT_VERSION, content });
const text = (value: string): CmsNode => ({ type: "text", text: value });
const paragraph = (...content: CmsNode[]): CmsNode => ({ type: "paragraph", content });
const ref = (label: string): CmsNode => ({ type: "footnoteReference", attrs: { label } });
const definition = (label: string, ...content: CmsNode[]): CmsNode => ({
	type: "footnoteDefinition",
	attrs: { label },
	content,
});

describe("analyzeDocument footnotes", () => {
	it("SITE-D3 numbers the references of the body first, then the ones inside definitions, wherever the definitions stand", () => {
		const analysis = analyzeDocument(
			doc(
				paragraph(text("one"), ref("a")),
				// A definition between two paragraphs of the body, with a reference of its own.
				definition("a", paragraph(text("note a"), ref("b"))),
				definition("b", paragraph(text("note b"))),
				paragraph(text("two"), ref("c")),
				definition("c", paragraph(text("note c"))),
			),
		);
		expect(analysis.footnotes.map(({ label, index, refIds }) => ({ label, index, refIds }))).toEqual([
			{ label: "a", index: 1, refIds: ["user-content-fnref-a"] },
			{ label: "c", index: 2, refIds: ["user-content-fnref-c"] },
			{ label: "b", index: 3, refIds: ["user-content-fnref-b"] },
		]);
	});
});
