import type { StoredDocument } from "@monti-cms/core/document";
import { describe, expect, it } from "vitest";
import { testSite } from "../../../../../core/test/site";
import { templatesMessages } from "../messages";
import { duplicateInput, newTemplateDoc, sectionsLine } from "../template-model";

const t = testSite.createTranslator(templatesMessages);
const text = (value: string) => ({ type: "text", text: value });
const doc = (content: StoredDocument["content"]): StoredDocument => ({ type: "doc", version: 3, content });

describe("sectionsLine", () => {
	it("lists the headings in order, whatever their level", () => {
		expect(
			sectionsLine(
				doc([
					{ type: "heading", id: "a1", attrs: { level: 2 }, content: [text("서론")] },
					{ type: "paragraph", id: "a2", content: [text("내용")] },
					{ type: "heading", id: "a3", attrs: { level: 3 }, content: [text("본론")] },
				]),
			),
		).toBe("서론 · 본론");
	});

	it("is empty when there is no heading, and skips an empty one", () => {
		expect(sectionsLine(doc([{ type: "paragraph", id: "a1", content: [text("내용")] }]))).toBe("");
		expect(sectionsLine(doc([{ type: "heading", id: "a1", attrs: { level: 2 }, content: [] }]))).toBe("");
	});

	it("reads the outline a new template starts from", () => {
		expect(sectionsLine(newTemplateDoc(t))).toBe(
			[t("newBody.introduction"), t("newBody.body"), t("newBody.conclusion")].join(" · "),
		);
	});
});

describe("duplicateInput", () => {
	it("keeps the body and gives every block an id of its own", () => {
		const source = newTemplateDoc(t);
		const copy = duplicateInput({ name: "기본 글", doc: source }, "기본 글 복사본");
		expect(copy.name).toBe("기본 글 복사본");
		expect(sectionsLine(copy.doc)).toBe(sectionsLine(source));
		const ids = (content: StoredDocument["content"]) => content.map((node) => node.id);
		expect(ids(copy.doc.content)).toHaveLength(source.content.length);
		for (const id of ids(copy.doc.content)) expect(ids(source.content)).not.toContain(id);
	});
});
