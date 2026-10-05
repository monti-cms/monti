import { forEachBlock } from "./block-ids";
import type { StoredDocument } from "./stored-document";
import { type BlockSources, toDocument } from "./to-document";
import type { CmsMdxAnalysis } from "./types";

/**
 * Which block a place in the body belongs to. The body text the stored document was written to is parsed (`analysis`), and the blocks
 * `toDocument` reads from it are the blocks of the stored document in the same order, so the n-th block of the stored document
 * (which has the id) is the n-th block of the parse (which knows where in the text it is).
 */

interface Span {
	readonly start: number;
	readonly end: number;
	readonly id: string;
	/** Index of the innermost span that holds this one, or -1. */
	readonly parent: number;
}

export interface BlockSpans {
	/** Id of the innermost block that holds the character at `offset` of the body, if there is one. */
	readonly blockIdAt: (offset: number) => string | undefined;
}

const NONE: BlockSpans = { blockIdAt: () => undefined };

/**
 * The block spans of a body. `doc` must be the stored document of `analysis` (as `bodyFromMdx` and `bodyFromDocument` return them).
 * A block that was not read from a source position has no span, so its place belongs to the block around it, if any.
 */
export const blockSpansOf = (analysis: CmsMdxAnalysis, doc: StoredDocument | null): BlockSpans => {
	if (!doc || !analysis.tree) return NONE;
	const sources: BlockSources = [];
	try {
		toDocument(analysis, sources);
	} catch {
		return NONE;
	}
	const ids: (string | undefined)[] = [];
	forEachBlock(doc.content, (block) => ids.push(block.id));
	// Trailing blank lines are read but not stored, and they come last, so the stored blocks are the first ones.
	if (sources.length < ids.length) return NONE;

	const sorted: Omit<Span, "parent">[] = [];
	ids.forEach((id, index) => {
		const source = sources[index];
		if (id !== undefined && source && source.end > source.start) sorted.push({ ...source, id });
	});
	// Blocks come in document order already; the sort is stable, so a block stays before the blocks it holds when they start together.
	sorted.sort((a, b) => a.start - b.start);

	const spans: Span[] = [];
	const open: number[] = [];
	for (const span of sorted) {
		while (open.length > 0 && (spans[open[open.length - 1] as number] as Span).end <= span.start) open.pop();
		spans.push({ ...span, parent: open.length > 0 ? (open[open.length - 1] as number) : -1 });
		open.push(spans.length - 1);
	}

	return {
		blockIdAt: (offset) => {
			// The last span that starts at or before the offset is the innermost one that could hold it, or sits after the one that does.
			let low = 0;
			let high = spans.length - 1;
			let found = -1;
			while (low <= high) {
				const middle = (low + high) >> 1;
				if ((spans[middle] as Span).start <= offset) {
					found = middle;
					low = middle + 1;
				} else {
					high = middle - 1;
				}
			}
			for (let index = found; index >= 0; index = (spans[index] as Span).parent) {
				const span = spans[index] as Span;
				if (offset < span.end) return span.id;
			}
			return undefined;
		},
	};
};
