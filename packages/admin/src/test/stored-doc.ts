import {
	assignBlockIds,
	type CmsJsonValue,
	type CmsMark,
	type CmsNode,
	canonicalDocument,
	STORED_DOCUMENT_VERSION,
	type StoredDocument,
} from "@monti-cms/core/document";
import type { JSONContent } from "@tiptap/core";
import { storedToTiptap } from "../editor/tiptap-content";

/**
 * Test helpers for documents that are built by hand (a table, a footnote, a block with attributes, ...): the admin has no text notation for them, so a test
 * names the stored nodes directly. The result is canonical and has block ids, as a document read by a format does.
 */

/** A stored document of `content`, in its canonical form with block ids. */
export const storedDoc = (...content: CmsNode[]): StoredDocument => {
	const doc = canonicalDocument({ type: "doc", version: STORED_DOCUMENT_VERSION, content });
	return { ...doc, content: assignBlockIds(doc.content, []) };
};

/** The editor's JSON for a document of `content`. */
export const tiptapOfNodes = (...content: CmsNode[]): JSONContent => storedToTiptap(storedDoc(...content));

/** A text node. */
export const text = (value: string, marks?: CmsMark[]): CmsNode => ({
	type: "text",
	text: value,
	...(marks ? { marks } : {}),
});

/** A paragraph of plain text (an empty one when `value` is empty). */
export const para = (value = ""): CmsNode => ({ type: "paragraph", content: value ? [text(value)] : [] });

/** A table of rows of cells; a cell is its inline content, or `{ attrs, content }` for a merged or header cell. */
export const table = (
	rows: Array<Array<CmsNode[] | { attrs?: Record<string, CmsJsonValue>; content: CmsNode[] }>>,
	attrs?: Record<string, CmsJsonValue>,
): CmsNode => ({
	type: "table",
	...(attrs ? { attrs } : {}),
	content: rows.map((row) => ({
		type: "tableRow",
		content: row.map((cell) =>
			Array.isArray(cell)
				? { type: "tableCell", content: cell }
				: { type: "tableCell", ...(cell.attrs ? { attrs: cell.attrs } : {}), content: cell.content },
		),
	})),
});

const dropRowIds = (node: CmsNode): CmsNode => {
	const { id: _id, ...rest } = node;
	const kept = node.type === "tableRow" || node.type === "tableCell" ? rest : node;
	return kept.content ? { ...kept, content: kept.content.map(dropRowIds) } : kept;
};

/**
 * The document without the ids of table rows and cells. The editor keeps ids of blocks only; a table row and a cell are paired with their ids again by the server,
 * so a comparison of a document with what the editor saves from it ignores them.
 */
export const withoutRowIds = (doc: StoredDocument): StoredDocument => ({
	...doc,
	content: doc.content.map(dropRowIds),
});

const dropIds = (node: CmsNode): CmsNode => {
	const { id: _id, ...rest } = node;
	return rest.content ? { ...rest, content: rest.content.map(dropIds) } : rest;
};

/** The document without any block id, to compare what an editor without the block id extension saves. */
export const withoutIds = (doc: StoredDocument): StoredDocument => ({ ...doc, content: doc.content.map(dropIds) });

/** A stored code block: its code and, as data, the annotations over it (a line label is `{ name: "anchor", start, end, attrs: { id } }`, lines counted from 0, `end` exclusive). */
export const codeNode = (
	code: string,
	options: { language?: string; meta?: string; annotations?: Record<string, CmsJsonValue> } = {},
): CmsNode => ({
	type: "codeBlock",
	attrs: {
		language: options.language ?? "ts",
		meta: options.meta ?? "",
		code,
		...(options.annotations ? { annotations: options.annotations } : {}),
	},
});

const walk = (nodes: readonly CmsNode[], visit: (node: CmsNode) => void) => {
	for (const node of nodes) {
		visit(node);
		if (node.content) walk(node.content, visit);
	}
};

/** The ids of the line labels (`anchor` annotations) of the code blocks of a document, in document order. */
export const anchorIdsOf = (doc: StoredDocument): string[] => {
	const ids: string[] = [];
	walk(doc.content, (node) => {
		if (node.type !== "codeBlock") return;
		const lines = (node.attrs?.annotations as { lines?: { name: string; attrs?: { id?: string } }[] } | undefined)
			?.lines;
		for (const line of lines ?? []) if (line.name === "anchor" && line.attrs?.id) ids.push(line.attrs.id);
	});
	return ids;
};

/** The targets (`to`) of the code links of a document, in document order. */
export const codeLinkTargetsOf = (doc: StoredDocument): string[] => {
	const targets: string[] = [];
	walk(doc.content, (node) => {
		for (const mark of node.marks ?? [])
			if (mark.type === "code-ref" && typeof mark.attrs?.to === "string") targets.push(mark.attrs.to);
	});
	return targets;
};

/** A text node linked to the code line labelled `to`. */
export const codeLink = (value: string, to: string): CmsNode => text(value, [{ type: "code-ref", attrs: { to } }]);
