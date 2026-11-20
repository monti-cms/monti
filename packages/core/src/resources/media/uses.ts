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

/** Every media id the uses reference, each once. */
function idsOf(uses: UsesByPath): string[] {
	return [...new Set([...uses.values()].flatMap((pathIds) => [...pathIds]))];
}

/** Rejects ids that are not active media items: missing from `media` or trashed. */
async function rejectInactive(ctx: WriteContext, ids: readonly string[]): Promise<void> {
	// `in ()` is not SQL: data with no media checks nothing.
	if (ids.length === 0) return;
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

/** Replaces the source's `media_uses` rows with `uses`. */
async function writeUses(ctx: WriteContext, source: UseSource, uses: UsesByPath): Promise<void> {
	await removeMediaUses(ctx, source);
	const rows = [...uses].flatMap(([field_path, pathIds]) =>
		[...pathIds].map((media_id) => ({ media_id, ...source, field_path })),
	);
	// An empty `values` is not SQL: no media leaves no rows.
	if (rows.length > 0) await ctx.db.insertInto("media_uses").values(rows).execute();
}

/** Replaces the source's `media_uses` rows with the media `doc` references at `field_path`; rejects inactive media. */
export async function replaceMediaUses(
	ctx: WriteContext,
	source: UseSource,
	field_path: string,
	doc: Doc,
): Promise<void> {
	const uses: UsesByPath = new Map([[field_path, mediaIdsOf(doc.blocks)]]);
	await rejectInactive(ctx, idsOf(uses));
	await writeUses(ctx, source, uses);
}

/** Adds `ids` to the ones `uses` has at `field_path`, lowercased. */
function addUses(uses: UsesByPath, field_path: string, ids: Iterable<string>): void {
	const pathIds = uses.get(field_path) ?? new Set<string>();
	for (const id of ids) pathIds.add(id.toLowerCase());
	uses.set(field_path, pathIds);
}

/** Adds the media checked entry `data` references in its media fields and its body to `uses`, by `field_path`. */
function addEntryUses(uses: UsesByPath, collection: CollectionSchema, data: EntryData): UsesByPath {
	for (const { path, field, value } of entryFieldValues(collection.fields, data.fields)) {
		if (field.type === "media") addUses(uses, path, [value].flat() as string[]);
	}
	if (data.body !== undefined) addUses(uses, "body", mediaIdsOf(data.body.blocks));
	return uses;
}

/** Rejects checked entry `data` whose media fields or body reference media that is not active. */
export async function rejectInactiveEntryMedia(
	ctx: WriteContext,
	collection: CollectionSchema,
	data: EntryData,
): Promise<void> {
	await rejectInactive(ctx, idsOf(addEntryUses(new Map(), collection, data)));
}

/**
 * Replaces an entry's `media_uses` rows with the union of what every one of its locales' working copies references,
 * after rejecting inactive media in `data`, the working copy being written. Call it once that copy is stored.
 */
export async function replaceEntryMediaUses(
	ctx: WriteContext,
	entryId: string,
	collection: CollectionSchema,
	data: EntryData,
): Promise<void> {
	await rejectInactiveEntryMedia(ctx, collection, data);
	await recountEntryMediaUses(ctx, entryId, collection);
}

/** Replaces an entry's `media_uses` rows with the union of what every one of its locales' working copies references. */
export async function recountEntryMediaUses(
	ctx: WriteContext,
	entryId: string,
	collection: CollectionSchema,
): Promise<void> {
	const locales = await ctx.db
		.selectFrom("entry_locales")
		.select("data")
		.where("entry_id", "=", entryId)
		.$castTo<{ data: EntryData }>()
		.execute();
	const uses: UsesByPath = new Map();
	for (const row of locales) addEntryUses(uses, collection, row.data);
	await writeUses(ctx, { source_kind: "entry", source_id: entryId }, uses);
}
