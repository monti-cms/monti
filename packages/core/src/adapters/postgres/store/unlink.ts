import { isDeepStrictEqual } from "node:util";
import { sql } from "kysely";
import { currentActor } from "../../../core/actor";
import type { UnlinkOutcome, UnlinkParams } from "../../../core/store/trash";
import { documentKeyHash } from "../../../core/translation/state-hash";
import { readReferenceOccurrences } from "../../../core/types";
import type { Db } from "../db/kysely";
import { type StoreContext, withTrx } from "./context";
import { recordEvents } from "./events";
import { extractVisibleText, loadEntry, readBodyDoc } from "./rows";

/**
 * Replaces the metadata references of one stored body and leaves its body references as they are. A reference keeps its stale flag; it is dropped when no
 * occurrence is left. Occurrences are written metadata first and body after, the order a save writes them, so a later identical save sees nothing to change.
 */
async function replaceMetadataReferences(
	db: Db,
	entryId: string,
	state: "working" | "published",
	metadataReferences: readonly {
		readonly kind: "entry" | "media";
		readonly targetId: string;
		readonly occurrences: readonly unknown[];
	}[],
): Promise<void> {
	const current = await db
		.selectFrom("entry_references")
		.select(["kind", "target_id", "is_stale", "occurrences"])
		.where("entry_id", "=", entryId)
		.where("state", "=", state)
		.execute();
	const key = (kind: string, targetId: string) => `${kind === "media" ? "media" : "entry"}:${targetId}`;

	const next = new Map<
		string,
		{ kind: "entry" | "media"; targetId: string; isStale: boolean; occurrences: unknown[] }
	>();
	for (const ref of metadataReferences) {
		next.set(key(ref.kind, ref.targetId), {
			kind: ref.kind,
			targetId: ref.targetId,
			isStale: false,
			occurrences: [...ref.occurrences],
		});
	}
	const before = new Map<string, { isStale: boolean; occurrences: unknown[] }>();
	for (const row of current) {
		const occurrences = readReferenceOccurrences(row.occurrences);
		const body = occurrences.filter((occurrence) => occurrence.type !== "metadata");
		const k = key(row.kind, row.target_id);
		before.set(k, { isStale: row.is_stale, occurrences });
		if (body.length === 0) continue;
		const entry = next.get(k) ?? {
			kind: row.kind === "media" ? ("media" as const) : ("entry" as const),
			targetId: row.target_id,
			isStale: false,
			occurrences: [],
		};
		entry.occurrences.push(...body);
		next.set(k, entry);
	}
	for (const [k, entry] of next) {
		const stored = before.get(k);
		if (stored && !entry.isStale) entry.isStale = stored.isStale;
	}

	const same =
		next.size === before.size &&
		[...next].every(([k, entry]) => {
			const stored = before.get(k);
			return stored && stored.isStale === entry.isStale && isDeepStrictEqual(stored.occurrences, entry.occurrences);
		});
	if (same) return;

	await db.deleteFrom("entry_references").where("entry_id", "=", entryId).where("state", "=", state).execute();
	for (const entry of next.values()) {
		const isMedia = entry.kind === "media";
		await db
			.insertInto("entry_references")
			.values({
				entry_id: entryId,
				state,
				kind: entry.kind,
				target_id: entry.targetId,
				target_entry_id: isMedia ? null : entry.targetId,
				target_media_id: isMedia ? entry.targetId : null,
				is_stale: entry.isStale,
				occurrences: JSON.stringify(entry.occurrences),
			})
			.execute();
	}
}

/** Unlinking entries from the relation fields that point at them. */
export function createUnlinkOps(ctx: StoreContext) {
	const { site, qSchema } = ctx;

	return {
		/**
		 * Takes the targets out of the relation fields of every entry that is not a target, in the working and the published body. Each changed body goes through
		 * the write rules (`rewrite`), so its hash, search text and references follow the data. Each changed entry's version goes up once and a `saved` event is recorded.
		 */
		unlinkReferences: async (params: UnlinkParams): Promise<UnlinkOutcome> =>
			withTrx(ctx, async (trx, client) => {
				const ids = new Set(params.targetIds ?? []);
				if (params.collection !== undefined) {
					const rows = await trx
						.selectFrom("entries")
						.select("id")
						.where("collection", "=", params.collection)
						.execute();
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
			}),
	};
}
