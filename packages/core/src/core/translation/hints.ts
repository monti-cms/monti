import { withoutBlockIds } from "../../doc/block-ids";
import type { StoredDocument } from "../../doc/stored-document";
import type { CmsMark, CmsNode } from "../../doc/types";
import type { Site } from "../../site";

const HINT: CmsMark = { type: "untranslated" };

/** Attaches a translation hint marker to each text node. Code, math and diagrams are not text nodes (attribute values) and stay as is. */
const hint = (site: Pick<Site, "sortMarks">, node: CmsNode): CmsNode => {
	if (node.type === "text") {
		if (!node.text?.trim()) return node;
		const marks = node.marks ?? [];
		return marks.some((mark) => mark.type === HINT.type) ? node : { ...node, marks: site.sortMarks([...marks, HINT]) };
	}
	return node.content ? { ...node, content: node.content.map((child) => hint(site, child)) } : node;
};

/**
 * Body of a new translation: keeps the source structure (headings, paragraphs, boxes, lists, tables) as is and gives its text the translation
 * hint mark (`untranslated`). The editor shows the hint text dimmed and removes it on typing.
 * Things that are not text nodes, such as code, images, math and box titles, are copied from the source unchanged. The blocks of a translation
 * are its own, so the result carries no block ids. A source that is not a document (an `unparsed` body) is returned as it is.
 */
export function withTranslationHints(site: Pick<Site, "sortMarks">, source: StoredDocument): StoredDocument {
	if (source.content.some((node) => node.type === "unparsed"))
		return { ...source, content: withoutBlockIds(source.content) };
	return { ...source, content: withoutBlockIds(source.content.map((node) => hint(site, node))) };
}
