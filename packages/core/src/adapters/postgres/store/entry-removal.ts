import { sql } from "kysely";
import type { PoolClient } from "pg";
import { assertDeletable, blockingTranslations, type GroupMember } from "../../../core/domain/lifecycle";
import { blockingUsages, type ReferrerRow } from "../../../core/domain/trash";
import { CmsError } from "../../../core/store/errors";
import type { Entry } from "../../../core/store/types";
import { readReferenceOccurrences } from "../../../core/types";
import type { Db } from "../db/kysely";
import type { StoreContext } from "./context";
import { recordEvents } from "./events";
import { loadEntry, lockEntryForUpdate } from "./rows";
import { ROW_COLLECTION, titleExpr } from "./title-sql";

/**
 * Taking entries out of the store for good: the rows, the reuse-prevention records of their addresses, and the references that point at them. Used by the
 * permanent delete of one entry and by the trash (a folder, a unit, the empty and the purge).
 */

/** The entries whose references point at `targetIds` (an entry or a media file), one row per stored reference. */
export async function referrersOf(
	db: Db,
	ctx: Pick<StoreContext, "site">,
	targets: { readonly entries?: readonly string[]; readonly media?: readonly string[] },
): Promise<ReferrerRow[]> {
	const entries = targets.entries ?? [];
	const media = targets.media ?? [];
	if (entries.length === 0 && media.length === 0) return [];
	const rows = await db
		.selectFrom("entry_references as r")
		.innerJoin("entries as e", "e.id", "r.entry_id")
		.leftJoin("entry_bodies as b", (join) =>
			join.onRef("b.entry_id", "=", "r.entry_id").onRef("b.state", "=", "r.state"),
		)
		.select([
			"r.entry_id",
			"e.collection",
			"e.status",
			"r.occurrences",
			titleExpr(ctx.site, "b.metadata", ROW_COLLECTION).as("title"),
		])
		.where((eb) =>
			eb.or([
				...(entries.length > 0 ? [eb("r.target_entry_id", "=", sql<string>`any(${[...entries]}::uuid[])`)] : []),
				...(media.length > 0 ? [eb("r.target_media_id", "=", sql<string>`any(${[...media]}::uuid[])`)] : []),
			]),
		)
		// The working body's title first: the usage names the entry as the editor shows it.
		.orderBy("r.state", "desc")
		.orderBy("r.entry_id")
		.execute();
	return rows.map((row) => ({
		entryId: row.entry_id,
		collection: row.collection,
		title: row.title,
		trashed: row.status === "trashed",
		occurrences: readReferenceOccurrences(row.occurrences),
	}));
}

/** Slugs that were ever published keep only a reuse-prevention record; reserved slugs that were never published are released before the content is deleted. */
export async function deleteEntryRow(trx: Db, id: string): Promise<void> {
	await trx.deleteFrom("content_addresses").where("entry_id", "=", id).where("type", "=", "reservation").execute();
	await trx
		.updateTable("content_addresses")
		.set({ type: "deleted", entry_id: null })
		.where("entry_id", "=", id)
		.execute();
	await trx.deleteFrom("entries").where("id", "=", id).execute();
}

/**
 * Deletes the entries `ids` (a source and its translations, or every entry of a folder) in the open transaction. Refuses with `in_use`, carrying the entries
 * whose relation fields point at them, when any entry outside `ids` does; a link in a body never refuses: the reference rows that point at the entries are
 * removed, and the link stays in the text as a broken link (a save already drops a link to an entry that is gone). Every entry that goes leaves a `deleted` event.
 */
export async function removeEntries(
	ctx: StoreContext,
	trx: Db,
	client: PoolClient,
	ids: readonly string[],
): Promise<Entry[]> {
	if (ids.length === 0) return [];
	const usages = blockingUsages(await referrersOf(trx, ctx, { entries: ids }), new Set(ids));
	if (usages.length > 0) {
		throw new CmsError("Other entries still reference this entry", "in_use", { details: { usages } });
	}
	await trx
		.deleteFrom("entry_references")
		.where("target_entry_id", "=", sql<string>`any(${[...ids]}::uuid[])`)
		.execute();
	// The events keep each entry as it was, so every one is read before its row goes.
	const removed: Entry[] = [];
	for (const id of ids) removed.push(await loadEntry(trx, id));
	// A translation names its source, so the translations go first.
	const isTranslation = (entry: Entry) => entry.translationGroupId !== entry.id;
	for (const entry of [...removed.filter(isTranslation), ...removed.filter((entry) => !isTranslation(entry))]) {
		await deleteEntryRow(trx, entry.id);
	}
	for (const entry of removed) await recordEvents(client, ctx.qSchema, ctx.site, entry, ["deleted"]);
	return removed;
}

/**
 * The translations of the source `id` (none for a translation), locked. Whether each was trashed with the source is compared here, in the database:
 * `deleted_at` keeps microseconds, and a JavaScript `Date` read from it only milliseconds.
 */
export async function lockTranslationsOf(trx: Db, id: string): Promise<GroupMember[]> {
	return (
		await trx
			.selectFrom("entries")
			.select((eb) => [
				"id",
				"status",
				eb(
					"deleted_at",
					"=",
					eb.selectFrom("entries as source").select("source.deleted_at").where("source.id", "=", id),
				).as("trashed_with_source"),
			])
			.where("translation_group_id", "=", id)
			.where("id", "<>", id)
			.orderBy("id")
			.forUpdate()
			.execute()
	).map((row) => ({ id: row.id, status: row.status, trashedWithSource: row.trashed_with_source === true }));
}

/**
 * Deletes a trashed entry for good, and its translations with it (see {@link removeEntries} for what holds it back). A translation outside the trash holds
 * the source back: it would lose its shared values.
 */
export async function removeEntryGroup(
	ctx: StoreContext,
	trx: Db,
	client: PoolClient,
	params: { id: string; expectedVersion?: number },
): Promise<Entry[]> {
	const locked = await lockEntryForUpdate(trx, params.id, params.expectedVersion);
	assertDeletable(locked.status, locked.version);
	const members = await lockTranslationsOf(trx, params.id);
	const alive = blockingTranslations(members);
	if (alive.length > 0) {
		const translations = await trx
			.selectFrom("entries")
			.select(["id", "locale"])
			.where("id", "=", sql<string>`any(${alive}::uuid[])`)
			.orderBy("locale")
			.execute();
		throw new CmsError("Delete the translations first", "has_translations", {
			serverVersion: locked.version,
			details: { translations },
		});
	}
	return removeEntries(ctx, trx, client, [...members.map((member) => member.id), params.id]);
}
