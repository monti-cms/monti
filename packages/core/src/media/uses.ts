import { type Kysely, sql, type Transaction } from "kysely";
import { asDoc, walk } from "../body/doc";
import type { Database } from "../db/schema";
import { CheckError } from "../errors";
import type { RecordRef } from "../operation";
import { lockRecords } from "../records";
import type { FieldDefinition, Schema } from "../schema/define";
import { type MediaPlace, mediaValueOf, placeKey } from "./value";

type Db = Kysely<Database> | Transaction<Database>;

type Use = { media: string; place: MediaPlace };

/** The files a body uses: any block with a `media` attr, wherever it sits (a list, a quote, a site's own block). */
export function usesInDoc(doc: unknown): Use[] {
	const uses: Use[] = [];
	for (const { block } of walk(asDoc(doc).blocks)) {
		const media = block.attrs?.media;
		if (typeof media === "string" && media !== "") uses.push({ media, place: { block: block.id } });
	}
	return uses;
}

/** The files an entry's fields use. A field the schema no longer has, or no longer calls media, uses nothing. */
export function usesInValues(fields: Record<string, FieldDefinition>, values: Record<string, unknown>): Use[] {
	return Object.entries(fields).flatMap(([field, definition]) => {
		if (definition.kind !== "media") return [];
		const value = mediaValueOf(values[field]);
		return value ? [{ media: value.media, place: { field } }] : [];
	});
}

/** How many entries and templates use each of these files; a file nobody uses is not in the answer. */
export async function usedOf(db: Db, ids: string[]): Promise<Map<string, number>> {
	if (ids.length === 0) return new Map();
	const rows = await db
		.selectFrom("media_uses")
		.select(["media_id", sql<number>`count(distinct coalesce(entry_id, template_id))::int`.as("uses")])
		.where("media_id", "in", ids)
		.groupBy("media_id")
		.execute();
	return new Map(rows.map((row) => [row.media_id, Number(row.uses)]));
}

/**
 * What every write of a field's value checks of a media field: it holds a file and what it says of it, and a field that takes images takes no other file. A file the
 * library does not have is the save's to keep: its use is simply not written. `null` clears the field.
 */
export async function checkMediaValues(
	db: Db,
	schema: Schema,
	collection: string,
	values: Record<string, unknown> | undefined,
): Promise<void> {
	const fields = schema.collections[collection]?.fields ?? {};
	for (const [field, given] of Object.entries(values ?? {})) {
		const definition = fields[field];
		if (definition?.kind !== "media" || given === null) continue;
		const value = mediaValueOf(given);
		if (!value) throw new CheckError({ key: "entries.badMedia", values: { field } });
		if (definition.accept === "any") continue;
		const file = await db.selectFrom("media").select("kind").where("id", "=", value.media).executeTakeFirst();
		if (file?.kind === "file") throw new CheckError({ key: "entries.badMediaKind", values: { field } });
	}
}

type Owner = { entry_id: string; template_id: null } | { entry_id: null; template_id: string };

/**
 * Writes the uses of these entries and templates again from what they hold now: the working copy and the published one both count (doc 09). The engine
 * calls it after every write, an undo and a schema change, so no operation that changes a body has to remember.
 *
 * Each file named is locked first, so this and `media.trash` take turns: a save that starts using a file either waits for the trash to finish and brings the file
 * back out, or makes the trash see the use and leave the file. Either way a file in use is never in the trash (09-4).
 */
export async function rewriteUses(db: Db, schema: Schema, refs: RecordRef[]): Promise<void> {
	const entryIds = refs.filter((ref) => ref.kind === "entry").map((ref) => ref.id);
	const templateIds = refs.filter((ref) => ref.kind === "template").map((ref) => ref.id);
	if (entryIds.length === 0 && templateIds.length === 0) return;

	const wanted = new Map<string, { media: string; owner: Owner; place: string }>();
	const want = (owner: Owner, uses: Use[]) => {
		for (const { media, place } of uses) {
			const key = placeKey(place);
			wanted.set(`${media}\n${owner.entry_id ?? owner.template_id}\n${key}`, { media, owner, place: key });
		}
	};
	if (entryIds.length > 0) {
		const working = await db
			.selectFrom("entries")
			.select(["id as owner", "collection", "values", "doc"])
			.where("id", "in", entryIds)
			.execute();
		const published = await db
			.selectFrom("entry_published")
			.select(["entry_id as owner", "collection", "values", "doc"])
			.where("entry_id", "in", entryIds)
			.execute();
		for (const copy of [...working, ...published])
			want({ entry_id: copy.owner, template_id: null }, [
				...usesInValues(schema.collections[copy.collection]?.fields ?? {}, copy.values),
				...usesInDoc(copy.doc),
			]);
	}
	if (templateIds.length > 0) {
		const templates = await db.selectFrom("templates").select(["id", "doc"]).where("id", "in", templateIds).execute();
		for (const template of templates) want({ entry_id: null, template_id: template.id }, usesInDoc(template.doc));
	}

	const named = [...new Set([...wanted.values()].map((use) => use.media))];
	await lockRecords(
		db,
		named.map((id) => ({ kind: "media", id })),
	);
	const existing =
		named.length === 0
			? new Set<string>()
			: new Set((await db.selectFrom("media").select("id").where("id", "in", named).execute()).map((row) => row.id));

	if (entryIds.length > 0) await db.deleteFrom("media_uses").where("entry_id", "in", entryIds).execute();
	if (templateIds.length > 0) await db.deleteFrom("media_uses").where("template_id", "in", templateIds).execute();
	const rows = [...wanted.values()]
		.filter((use) => existing.has(use.media))
		.map((use) => ({ media_id: use.media, place: use.place, ...use.owner }));
	if (rows.length === 0) return;
	await db.insertInto("media_uses").values(rows).execute();
	await bringBack(db, [...existing]);
}

/** A file in the trash that is used again (an undo, a proposal written before it was trashed) comes back out. */
async function bringBack(db: Db, ids: string[]): Promise<void> {
	await db
		.updateTable("media")
		.set((eb) => ({ trashed_at: null, version: eb("version", "+", 1) }))
		.where("id", "in", ids)
		.where("trashed_at", "is not", null)
		.execute();
	await leaveNoFileInAGoneFolder(db, ids);
}

/** A file that is out of the trash can be seen only in a folder that is: otherwise it waits at the top level. For whatever puts files back (an undo, `bringBack`). */
export async function leaveNoFileInAGoneFolder(db: Db, ids: string[]): Promise<void> {
	if (ids.length === 0) return;
	await db
		.updateTable("media")
		.set((eb) => ({ folder_id: null, version: eb("version", "+", 1) }))
		.where("id", "in", ids)
		.where("trashed_at", "is", null)
		.where("folder_id", "is not", null)
		.where(({ exists, not, selectFrom }) =>
			not(
				exists(
					selectFrom("folders")
						.select("folders.id")
						.whereRef("folders.id", "=", "media.folder_id")
						.where("folders.trashed_at", "is", null),
				),
			),
		)
		.execute();
}

/** Every entry's and template's uses again, after a schema change moved or dropped what they hold. */
export async function rewriteAllUses(db: Db, schema: Schema): Promise<void> {
	const entries = await db.selectFrom("entries").select("id").execute();
	const templates = await db.selectFrom("templates").select("id").execute();
	await rewriteUses(db, schema, [
		...entries.map((row) => ({ kind: "entry", id: row.id })),
		...templates.map((row) => ({ kind: "template", id: row.id })),
	]);
}
