import { sql } from "kysely";
import type { PoolClient } from "pg";
import { currentActor } from "../../../core/actor";
import type { UnlinkOutcome, UnlinkParams } from "../../../core/store/trash";
import { documentKeyHash } from "../../../core/translation/state-hash";
import type { Db } from "../db/kysely";
import { type StoreContext, withTrx } from "./context";
import { recordEvents } from "./events";
import { replaceMetadataReferences } from "./metadata-references";
import { extractVisibleText, loadEntry, readBodyDoc } from "./rows";

/**
 * Takes the targets out of the relation fields of every entry that is not a target, in the working and the published body, inside the transaction `trx`. Each
 * changed body goes through the write rules (`rewrite`), so its hash, search text and references follow the data. Each changed entry's version goes up once and a
 * `saved` event is recorded.
 */
export async function unlinkInTrx(
	ctx: StoreContext,
	trx: Db,
	client: PoolClient,
	params: UnlinkParams,
): Promise<UnlinkOutcome> {
	const { site, qSchema } = ctx;
	const ids = new Set(params.targetIds ?? []);
	if (params.collection !== undefined) {
		const rows = await trx.selectFrom("entries").select("id").where("collection", "=", params.collection).execute();
		for (const row of rows) ids.add(row.id);
	}
	if (ids.size === 0) return { entries: 0, entryIds: [] };
	const targets = sql<string>`any(${[...ids]}::uuid[])`;

	const pointing = await trx
		.selectFrom("entry_references")
		.select(["entry_id", "state"])
		.distinct()
		.where("target_entry_id", "=", targets)
		.where("entry_id", "<>", sql<string>`all(${[...ids]}::uuid[])`)
		.where(sql<boolean>`jsonb_path_exists(occurrences, '$[*] ? (@.type == "metadata")')`)
		.orderBy("entry_id")
		.execute();
	const entryIds = [...new Set(pointing.map((row) => row.entry_id))];
	if (entryIds.length === 0) return { entries: 0, entryIds: [] };

	// The entries are locked in a fixed order, so two unlinks cannot wait on each other.
	await trx
		.selectFrom("entries")
		.select("id")
		.where("id", "=", sql<string>`any(${entryIds}::uuid[])`)
		.orderBy("id")
		.forUpdate()
		.execute();

	const changed: string[] = [];
	for (const entryId of entryIds) {
		const entry = await trx
			.selectFrom("entries")
			.select("collection")
			.where("id", "=", entryId)
			.executeTakeFirstOrThrow();
		const bodies = await trx
			.selectFrom("entry_bodies")
			.select(["state", "metadata", "doc"])
			.where("entry_id", "=", entryId)
			.execute();
		let touched = false;
		for (const body of bodies) {
			const rewritten = await params.rewrite(
				{
					entryId,
					collection: entry.collection,
					state: body.state,
					metadata: body.metadata,
					doc: readBodyDoc(body.doc),
				},
				ids,
			);
			if (!rewritten) continue;
			touched = true;
			await trx
				.updateTable("entry_bodies")
				.set({
					metadata: JSON.stringify(rewritten.metadata),
					doc: JSON.stringify(rewritten.doc),
					content_hash: rewritten.contentHash,
					doc_key_hash: documentKeyHash(rewritten.doc),
					search_text: extractVisibleText(site, rewritten.doc),
					updated_at: sql<Date>`now()`,
				})
				.where("entry_id", "=", entryId)
				.where("state", "=", body.state)
				.execute();
			await replaceMetadataReferences(trx, entryId, body.state, rewritten.references);
		}
		if (!touched) continue;
		await trx
			.updateTable("entries")
			.set({
				version: sql<number>`version + 1`,
				updated_at: sql<Date>`now()`,
				changed_by: currentActor(),
				changed_at: sql<Date>`now()`,
			})
			.where("id", "=", entryId)
			.execute();
		await recordEvents(client, qSchema, site, await loadEntry(trx, entryId), ["saved"]);
		changed.push(entryId);
	}
	return { entries: changed.length, entryIds: changed };
}

/** Unlinking entries from the relation fields that point at them. */
export function createUnlinkOps(ctx: StoreContext) {
	return {
		/** `unlinkInTrx` in a transaction of its own. */
		unlinkReferences: async (params: UnlinkParams): Promise<UnlinkOutcome> =>
			withTrx(ctx, (trx, client) => unlinkInTrx(ctx, trx, client, params)),
	};
}
