import type { Doc } from "@monti-cms/core";

/**
 * How much of a request's context the unsaved values may take, in characters of JSON. The server takes a context of 200,000 at most
 * (`ScreenContext`): the rest is left for the screen, the entry and what is picked.
 */
export const MOST_DRAFT = 150_000;

const size = (value: unknown) => JSON.stringify(value)?.length ?? 0;

/**
 * The open screen's unsaved values as they go along with a request to the assistant (doc 10, the context table's unsaved values): each changed place of the
 * draft with its value now (`title`, `slug`, `doc`, `values.<field>`). "Summarize this entry" then works from what is on the screen, not
 * from what was saved last.
 *
 * A body too large for the request is cut at a block: the blocks from the start that fit go whole, and `docCut` says how many of how many
 * went, so the model knows it has not read to the end. Nothing unsaved is nothing sent.
 */
export function draftContext(
	changes: readonly { path: string; after: unknown }[],
	most = MOST_DRAFT,
): Record<string, unknown> | undefined {
	if (changes.length === 0) return undefined;
	const draft: Record<string, unknown> = Object.fromEntries(
		changes.map((change) => [change.path, change.after ?? null]),
	);
	if (size(draft) <= most) return draft;
	const doc = draft.doc as Doc | null | undefined;
	const blocks = doc?.blocks;
	if (!doc || !Array.isArray(blocks)) return undefined;
	// What the other places and the cut's own note take is the body's to leave free.
	const note = { blocks: blocks.length, of: blocks.length };
	const rest = size({ ...draft, doc: { ...doc, blocks: [] }, docCut: note });
	if (rest > most) return undefined;
	let room = most - rest;
	const kept: Doc["blocks"] = [];
	for (const block of blocks) {
		// Each block with the comma that joins it to the one before.
		const needs = size(block) + 1;
		if (needs > room) break;
		kept.push(block);
		room -= needs;
	}
	return { ...draft, doc: { ...doc, blocks: kept }, docCut: { blocks: kept.length, of: blocks.length } };
}
