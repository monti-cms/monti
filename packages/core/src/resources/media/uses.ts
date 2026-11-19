import type { MediaUsesTable } from "../../db/types";
import { MontiError } from "../../engine/errors";
import type { WriteContext } from "../../engine/types";
import type { Block, Doc } from "../../rich-text/types";

/** The entry or template whose `media_uses` rows are written. */
interface UseSource {
	source_kind: MediaUsesTable["source_kind"];
	source_id: string;
}

/** Every media id the blocks and their children reference in `attrs.mediaId` or `attrs.mediaIds`, each once. */
function mediaIdsOf(blocks: readonly Block[], ids = new Set<string>()): Set<string> {
	for (const block of blocks) {
		const { mediaId, mediaIds } = block.attrs ?? {};
		if (typeof mediaId === "string") ids.add(mediaId);
		if (Array.isArray(mediaIds)) for (const id of mediaIds) if (typeof id === "string") ids.add(id);
		mediaIdsOf(block.children ?? [], ids);
	}
	return ids;
}

/** Rejects ids that are not active media items: missing from `media` or trashed. */
async function rejectInactive(ctx: WriteContext, ids: readonly string[]): Promise<void> {
	const active = await ctx.db
		.selectFrom("media")
		.select("id")
		.where("id", "in", ids)
		.where("trashed_at", "is", null)
		.execute();
	if (active.length !== ids.length) throw new MontiError("BAD_REQUEST", "The body references media that is not active");
}

/** Deletes the source's `media_uses` rows. */
export async function removeMediaUses(ctx: WriteContext, source: UseSource): Promise<void> {
	await ctx.db
		.deleteFrom("media_uses")
		.where("source_kind", "=", source.source_kind)
		.where("source_id", "=", source.source_id)
		.execute();
}

/** Replaces the source's `media_uses` rows with the active media `doc` references at `field_path`. */
export async function replaceMediaUses(
	ctx: WriteContext,
	source: UseSource,
	field_path: string,
	doc: Doc,
): Promise<void> {
	const ids = [...mediaIdsOf(doc.blocks)];
	// `in ()` and an empty `values` are not SQL: a body with no media checks nothing and leaves no rows.
	if (ids.length > 0) await rejectInactive(ctx, ids);
	await removeMediaUses(ctx, source);
	if (ids.length === 0) return;
	await ctx.db
		.insertInto("media_uses")
		.values(ids.map((media_id) => ({ media_id, ...source, field_path })))
		.execute();
}
