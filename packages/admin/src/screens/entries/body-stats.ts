import type { CmsNode, StoredDocument } from "@monti-cms/core/document";

/** Reading speed behind the estimate: characters (whitespace excluded) per minute. Korean has no spaces to count words by, so characters are the measure. */
export const READING_CHARS_PER_MINUTE = 500;

export interface BodyStats {
	/** Characters without whitespace. */
	chars: number;
	/** Characters with whitespace. */
	charsWithSpaces: number;
	/** Runs of non-whitespace characters, counted per text block (so a bold word inside a word does not split it). */
	words: number;
	/** Text blocks that are not headings, and headings. Empty ones are not counted. */
	paragraphs: number;
	headings: number;
	/** Reading time in whole minutes, at least 1. */
	minutes: number;
}

const inlineText = (node: CmsNode): string =>
	(node.text ?? "") + (node.content ?? []).map((child) => inlineText(child)).join("");

// A text block holds text directly (a paragraph, a heading, a list item's paragraph); its parents only hold blocks.
const isTextBlock = (node: CmsNode) => (node.content ?? []).some((child) => child.text !== undefined);

function walk(nodes: readonly CmsNode[] | undefined, stats: Omit<BodyStats, "minutes">) {
	for (const node of nodes ?? []) {
		if (isTextBlock(node)) {
			const text = inlineText(node);
			if (/\S/.test(text)) {
				stats.chars += text.replace(/\s/g, "").length;
				stats.charsWithSpaces += text.length;
				stats.words += text.match(/\S+/g)?.length ?? 0;
				if (node.type === "heading") stats.headings += 1;
				else stats.paragraphs += 1;
			}
		} else if (node.text) {
			// A bare text node outside a text block (not produced by the editor): count its characters only.
			stats.chars += node.text.replace(/\s/g, "").length;
			stats.charsWithSpaces += node.text.length;
		}
		if (!isTextBlock(node)) walk(node.content, stats);
	}
}

/** Sizes of the body and the reading time. Counts the text of every block, nested ones included. */
export function bodyStats(doc: StoredDocument): BodyStats {
	const stats = { chars: 0, charsWithSpaces: 0, words: 0, paragraphs: 0, headings: 0 };
	walk(doc.content, stats);
	return { ...stats, minutes: Math.max(1, Math.round(stats.chars / READING_CHARS_PER_MINUTE)) };
}
