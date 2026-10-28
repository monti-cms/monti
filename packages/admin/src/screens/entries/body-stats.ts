import type { CmsNode, StoredDocument } from "@monti-cms/core/document";

const inlineText = (node: CmsNode): string =>
	(node.text ?? "") + (node.content ?? []).map((child) => inlineText(child)).join("");

// A text block holds text directly (a paragraph, a heading, a list item's paragraph); its parents only hold blocks.
const isTextBlock = (node: CmsNode) => (node.content ?? []).some((child) => child.text !== undefined);

const countChars = (nodes: readonly CmsNode[] | undefined): number =>
	(nodes ?? []).reduce((sum, node) => {
		if (isTextBlock(node)) return sum + inlineText(node).replace(/\s/g, "").length;
		// A bare text node outside a text block (not produced by the editor) counts too.
		return sum + (node.text?.replace(/\s/g, "").length ?? 0) + countChars(node.content);
	}, 0);

/** The size of the body the status bar shows: its characters without whitespace, nested blocks included. */
export const bodyChars = (doc: StoredDocument): number => countChars(doc.content);
