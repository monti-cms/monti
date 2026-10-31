import type { StoredDocument } from "@monti-cms/core/document";
import { describe, expect, it } from "vitest";
import { testSite } from "../../../../../core/test/site";
import { templatesMessages } from "../messages";
import { duplicateInput, newTemplateDoc, sectionsLine } from "../template-model";

const t = testSite.createTranslator(templatesMessages);

describe("sectionsLine", () => {
	it("TPL-N1 reads the outline a new template starts from", () => {
		expect(sectionsLine(newTemplateDoc(t))).toBe(
			[t("newBody.introduction"), t("newBody.body"), t("newBody.conclusion")].join(" · "),
		);
	});
});

describe("duplicateInput", () => {
	it("TPL-L1 keeps the body and gives every block an id of its own", () => {
		const source = newTemplateDoc(t);
		const copy = duplicateInput({ name: "기본 글", doc: source }, "기본 글 복사본");
		expect(copy.name).toBe("기본 글 복사본");
		expect(sectionsLine(copy.doc)).toBe(sectionsLine(source));
		const ids = (content: StoredDocument["content"]) => content.map((node) => node.id);
		expect(ids(copy.doc.content)).toHaveLength(source.content.length);
		for (const id of ids(copy.doc.content)) expect(ids(source.content)).not.toContain(id);
	});
});
