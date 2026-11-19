import type { MediaUsesTable } from "../../db/types";
import { MontiError } from "../../engine/errors";
import type { CollectionSchema, FieldSchema, ValueFieldSchema, WriteContext } from "../../engine/types";
import type { Block, Doc } from "../../rich-text/types";

/** The entry or template whose `media_uses` rows are written. */
interface UseSource {
	source_kind: MediaUsesTable["source_kind"];
	source_id: string;
}

/** The media ids each `field_path` references, lowercased and each once per path. */
type UsesByPath = Map<string, Set<string>>;

/** An entry's `data`: field values by key and the rich-text body. */
export interface EntryData {
	fields: Record<string, unknown>;
	body?: Doc;
}

/** One value field an entry's data sets, top-level or a conditional's sub-field, with its `field_path`. */
interface EntryFieldValue {
	path: string;
	field: ValueFieldSchema;
	value: unknown;
}

/** Every media id the blocks and their children reference in `attrs.mediaId` or `attrs.mediaIds`, lowercased and each once. */
function mediaIdsOf(blocks: readonly Block[], ids = new Set<string>()): Set<string> {
	for (const block of blocks) {
		const { mediaId, mediaIds } = block.attrs ?? {};
		if (typeof mediaId === "string") ids.add(mediaId.toLowerCase());
		if (Array.isArray(mediaIds)) for (const id of mediaIds) if (typeof id === "string") ids.add(id.toLowerCase());
		mediaIdsOf(block.children ?? [], ids);
	}
	return ids;
}

/**
 * The value fields that checked `values` set: a top-level one at `fields.<key>`, a conditional's sub-field at
 * `fields.<key>.fields.<sub>` under its chosen option.
 */
export function entryFieldValues(
	fields: Record<string, FieldSchema>,
	values: Record<string, unknown>,
	prefix = "fields",
): EntryFieldValue[] {
	return Object.entries(values).flatMap(([key, value]) => {
		// An explicit `undefined` is a field left out, as `JSON.stringify` stores it.
		if (value === undefined) return [];
		const field = fields[key];
		const path = `${prefix}.${key}`;
		if (field.type !== "conditional") return [{ path, field, value }];
		const chosen = value as { option: string; fields: Record<string, unknown> };
		return entryFieldValues(field.options[chosen.option].fields, chosen.fields, `${path}.fields`);
	});
}

/** Rejects ids that are not active media items: missing from `media` or trashed. */
async function rejectInactive(ctx: WriteContext, ids: readonly string[]): Promise<void> {
	const active = await ctx.db
		.selectFrom("media")
		.select("id")
		.where("id", "in", ids)
		.where("trashed_at", "is", null)
		.execute();
	if (active.length !== ids.length) throw new MontiError("BAD_REQUEST", "The data references media that is not active");
}

/** Deletes the source's `media_uses` rows. */
export async function removeMediaUses(ctx: WriteContext, source: UseSource): Promise<void> {
	await ctx.db
		.deleteFrom("media_uses")
		.where("source_kind", "=", source.source_kind)
		.where("source_id", "=", source.source_id)
		.execute();
}

/** Replaces the source's `media_uses` rows with `uses`, after checking every media they reference is active. */
async function writeUses(ctx: WriteContext, source: UseSource, uses: UsesByPath): Promise<void> {
	const ids = new Set([...uses.values()].flatMap((pathIds) => [...pathIds]));
	// `in ()` and an empty `values` are not SQL: data with no media checks nothing and leaves no rows.
	if (ids.size > 0) await rejectInactive(ctx, [...ids]);
	await removeMediaUses(ctx, source);
	const rows = [...uses].flatMap(([field_path, pathIds]) =>
		[...pathIds].map((media_id) => ({ media_id, ...source, field_path })),
	);
	if (rows.length > 0) await ctx.db.insertInto("media_uses").values(rows).execute();
}

/** Replaces the source's `media_uses` rows with the active media `doc` references at `field_path`. */
export async function replaceMediaUses(
	ctx: WriteContext,
	source: UseSource,
	field_path: string,
	doc: Doc,
): Promise<void> {
	await writeUses(ctx, source, new Map([[field_path, mediaIdsOf(doc.blocks)]]));
}

/** Replaces an entry's `media_uses` rows with the media its checked `data` references in media fields and the body. */
export async function replaceEntryMediaUses(
	ctx: WriteContext,
	entryId: string,
	collection: CollectionSchema,
	data: EntryData,
): Promise<void> {
	const uses: UsesByPath = new Map();
	for (const { path, field, value } of entryFieldValues(collection.fields, data.fields)) {
		if (field.type === "media") uses.set(path, new Set(([value].flat() as string[]).map((id) => id.toLowerCase())));
	}
	if (data.body !== undefined) uses.set("body", mediaIdsOf(data.body.blocks));
	await writeUses(ctx, { source_kind: "entry", source_id: entryId }, uses);
}
