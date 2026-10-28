import {
	assignBlockIds,
	type CmsNode,
	regenerateBlockIds,
	STORED_DOCUMENT_VERSION,
	type StoredDocument,
} from "@monti-cms/core/document";
import type { BodyTemplate } from "@monti-cms/core/site";
import type { TranslatorFor } from "../../translator";
import type { templatesMessages } from "./messages";

const textNode = (text: string): CmsNode => ({ type: "text", text });
const heading = (text: string): CmsNode => ({ type: "heading", attrs: { level: 2 }, content: [textNode(text)] });
const paragraph = (text: string): CmsNode => ({ type: "paragraph", content: [textNode(text)] });
const item = (text: string): CmsNode => ({ type: "listItem", content: [paragraph(text)] });

/** Initial body of a new template: an outline with three sections. */
export const newTemplateDoc = (t: TranslatorFor<typeof templatesMessages>): StoredDocument => ({
	type: "doc",
	version: STORED_DOCUMENT_VERSION,
	content: assignBlockIds([
		heading(t("newBody.introduction")),
		paragraph(t("newBody.enterContent")),
		heading(t("newBody.body")),
		{ type: "bulletList", content: [item(t("newBody.item1")), item(t("newBody.item2"))] },
		heading(t("newBody.conclusion")),
		paragraph(t("newBody.summary")),
	]),
});

const textOf = (node: CmsNode): string => (node.text ?? "") + (node.content ?? []).map(textOf).join("");

/** The sections of a template as its row says them: the headings of its body in order, joined by " · ". Empty when the body has none. */
export const sectionsLine = (doc: StoredDocument): string =>
	doc.content
		.filter((node) => node.type === "heading")
		.map((node) => textOf(node).trim())
		.filter((text) => text !== "")
		.join(" · ");

/** What a duplicate is created from: the same body with block ids of its own (ids are unique within a body, and a template's must not end up twice). */
export const duplicateInput = (template: Pick<BodyTemplate, "name" | "doc">, name: string) => ({
	name,
	doc: { ...template.doc, content: regenerateBlockIds(template.doc.content) },
});
