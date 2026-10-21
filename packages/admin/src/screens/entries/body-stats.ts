import type { CmsNode, StoredDocument } from "@monti-cms/core/document";

/** Reading speed behind the estimate: characters (whitespace excluded) per minute. Korean has no spaces to count words by, so characters are the measure. */
export const READING_CHARS_PER_MINUTE = 500;

const countNodes = (nodes: readonly CmsNode[] | undefined): number => {
	let total = 0;
	for (const node of nodes ?? []) {
		if (node.text) total += node.text.replace(/\s/g, "").length;
		total += countNodes(node.content);
	}
	return total;
};

/** Characters of the body without whitespace, and the reading time in whole minutes (at least 1). Counts the text of every block, nested ones included. */
export function bodyStats(doc: StoredDocument): { chars: number; minutes: number } {
	const chars = countNodes(doc.content);
	return { chars, minutes: Math.max(1, Math.round(chars / READING_CHARS_PER_MINUTE)) };
}
