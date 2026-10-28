import { isDeepStrictEqual } from "node:util";
import { sql } from "kysely";
import type { PoolClient } from "pg";
import { CmsError } from "../../../core/store/errors";
import type { SchemaChangeStore } from "../../../core/store/ports";
import type {
	CollectionFootprint,
	DroppedCollection,
	FootprintReferrer,
	ScannedBody,
} from "../../../core/store/schema-change";
import type { Entry, EntryMetadata, EntryStatus, JsonObject } from "../../../core/store/types";
import { documentKeyHash } from "../../../core/translation/state-hash";
import { readReferenceOccurrences } from "../../../core/types";
import type { Db } from "../db/kysely";
import { type StoreContext, withTrx } from "./context";
import { recordEvents } from "./events";
import { extractVisibleText, loadEntry, readBodyDoc } from "./rows";
import { prepare } from "./schema";
import { ROW_COLLECTION, titleExpr } from "./title-sql";

const DEFAULT_BATCH_SIZE = 200;

/** The name a schema transform is recorded under in `cms_migrations`. */
const recordName = (id: string): string => `schema:${id}`;

interface BodyScanRow {
	entry_id: string;
	collection: string;
	locale: string;
	is_translation: boolean;
	status: EntryStatus;
	state: "working" | "published";
	metadata: EntryMetadata;
	doc: unknown;
}

const toScanned = (row: BodyScanRow): ScannedBody => ({
	entryId: row.entry_id,
	collection: row.collection,
	locale: row.locale,
	isTranslation: row.is_translation,
	status: row.status,
	state: row.state,
	metadata: row.metadata,
	doc: readBodyDoc(row.doc),
});

/** A batch of bodies after the key `after` (entry id, state), `collections` only when given. `lock` takes the row locks of the transaction. */
async function readBatch(
	db: Db,
	params: {
		collections?: readonly string[];
		after?: { entryId: string; state: string };
		limit: number;
		lock?: boolean;
	},
): Promise<BodyScanRow[]> {
	const { collections, after } = params;
	return db
		.selectFrom("entry_bodies as b")
		.innerJoin("entries as e", "e.id", "b.entry_id")
		.select((eb) => [
			"b.entry_id",
			"e.collection",
			"e.locale",
			eb
				.and([eb("e.translation_group_id", "is not", null), eb("e.translation_group_id", "<>", eb.ref("e.id"))])
				.$castTo<boolean>()
				.as("is_translation"),
			"e.status",
			"b.state",
			"b.metadata",
			"b.doc",
		])
		.$if(collections !== undefined, (qb) =>
			qb.where("e.collection", "=", sql<string>`any(${[...(collections as readonly string[])]}::text[])`),
		)
		.$if(after !== undefined, (qb) =>
			qb.where(sql<boolean>`(b.entry_id, b.state) > (${after?.entryId}::uuid, ${after?.state}::text)`),
		)
		.orderBy("b.entry_id")
		.orderBy("b.state")
		.limit(params.limit)
		.$if(params.lock === true, (qb) => qb.forUpdate("b"))
		.execute();
}

/**
 * Replaces the metadata references of one stored body and leaves its body references as they are. A reference keeps its stale flag; it is dropped when no
 * occurrence is left. Occurrences are written metadata first and body after, the order a save writes them, so a later identical save sees nothing to change.
 */
export async function replaceMetadataReferences(
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

/** The reference rows that are relation fields (the metadata of the referring entry), not links in its body. */
const isRelationReference = sql<boolean>`r.occurrences @> '[{"type":"metadata"}]'::jsonb`;

/** Entries (translation groups, translations apart), folders and addresses of collections, in three grouped reads. */
async function readFootprintCounts(
	db: Db,
	collections: readonly string[],
): Promise<Map<string, Omit<CollectionFootprint, "incoming">>> {
	const list = sql<string>`any(${[...collections]}::text[])`;
	const entries = await db
		.selectFrom("entries")
		.select([
			"collection",
			sql<string>`count(*) filter (where translation_group_id is null or translation_group_id = id)`.as("entries"),
			sql<string>`count(*) filter (where (translation_group_id is null or translation_group_id = id) and status = 'trashed')`.as(
				"trashed",
			),
			sql<string>`count(*) filter (where translation_group_id is not null and translation_group_id <> id)`.as(
				"translations",
			),
		])
		.where("collection", "=", list)
		.groupBy("collection")
		.execute();
	const folders = await db
		.selectFrom("folders")
		.select(["collection", sql<string>`count(*)`.as("n")])
		.where("collection", "=", list)
		.groupBy("collection")
		.execute();
	const addresses = await db
		.selectFrom("content_addresses")
		.select(["collection", sql<string>`count(*)`.as("n")])
		.where("collection", "=", list)
		.groupBy("collection")
		.execute();

	const result = new Map<string, Omit<CollectionFootprint, "incoming">>();
	for (const collection of collections) {
		const row = entries.find((item) => item.collection === collection);
		result.set(collection, {
			entries: Number(row?.entries ?? 0),
			trashed: Number(row?.trashed ?? 0),
			translations: Number(row?.translations ?? 0),
			folders: Number(folders.find((item) => item.collection === collection)?.n ?? 0),
			addresses: Number(addresses.find((item) => item.collection === collection)?.n ?? 0),
		});
	}
	return result;
}

/** Thrown inside the transaction of a dry run to roll it back. */
class DryRunRollback extends Error {}

/** The schema-change part of the content store: reads the applied schema, scans bodies, and applies the transforms (`SchemaChangeStore`). */
export function createSchemaChangeOps(ctx: StoreContext): SchemaChangeStore {
	const { site, qSchema } = ctx;
	const db = ctx.db();

	/** Entries of other collections whose relation fields point into `collection`, with the first few by creation. */
	const readRelationReferrers = async (
		reader: Db,
		collection: string,
		sampleSize: number,
	): Promise<{ count: number; sample: FootprintReferrer[] }> => {
		const counted = await reader
			.selectFrom("entry_references as r")
			.innerJoin("entries as t", "t.id", "r.target_entry_id")
			.innerJoin("entries as e", "e.id", "r.entry_id")
			.select(sql<string>`count(distinct r.entry_id)`.as("n"))
			.where("t.collection", "=", collection)
			.where("e.collection", "<>", collection)
			.where(isRelationReference)
			.executeTakeFirst();
		const rows = await reader
			.selectFrom("entry_references as r")
			.innerJoin("entries as t", "t.id", "r.target_entry_id")
			.innerJoin("entries as e", "e.id", "r.entry_id")
			.leftJoin("entry_bodies as b", (join) => join.onRef("b.entry_id", "=", "e.id").on("b.state", "=", "working"))
			.select([
				"e.id",
				"e.collection",
				"e.locale",
				"e.status",
				"e.created_at",
				titleExpr(site, "b.metadata", ROW_COLLECTION).as("title"),
			])
			.distinct()
			.where("t.collection", "=", collection)
			.where("e.collection", "<>", collection)
			.where(isRelationReference)
			.orderBy("e.created_at")
			.orderBy("e.id")
			.limit(sampleSize)
			.execute();
		return {
			count: Number(counted?.n ?? 0),
			sample: rows.map((row) => ({
				id: row.id,
				title: row.title,
				collection: row.collection,
				locale: row.locale,
				status: row.status,
			})),
		};
	};

	/** Deletes everything a collection holds. The caller has checked that no relation field of another collection points into it. */
	const dropCollectionRows = async (trx: Db, client: PoolClient, collection: string): Promise<DroppedCollection> => {
		const counts = (await readFootprintCounts(trx, [collection])).get(collection);
		const members = await trx
			.selectFrom("entries")
			.select("id")
			.where("collection", "=", collection)
			.orderBy("id")
			.forUpdate()
			.execute();
		const blocking = await readRelationReferrers(trx, collection, 5);
		if (blocking.count > 0) {
			throw new CmsError(`Entries of other collections still point at "${collection}"`, "in_use", {
				details: { collection, count: blocking.count, usages: blocking.sample },
			});
		}
		// Every entry that goes leaves a `deleted` event, each read before its row is deleted and written after (the same order as a permanent delete).
		const removed: Entry[] = [];
		for (const member of members) removed.push(await loadEntry(trx, member.id));

		const inCollection = trx.selectFrom("entries").select("id").where("collection", "=", collection);
		// Body links from other collections: the rows go, the links stay in the text and show as broken. (Rows of the collection's own entries go with the entries.)
		await trx.deleteFrom("entry_references").where("target_entry_id", "in", inCollection).execute();
		await trx.deleteFrom("content_addresses").where("collection", "=", collection).execute();
		await trx
			.deleteFrom("entries")
			.where("collection", "=", collection)
			.where("translation_group_id", "is not", null)
			.where(sql<boolean>`translation_group_id <> id`)
			.execute();
		await trx.deleteFrom("entries").where("collection", "=", collection).execute();
		await trx.deleteFrom("folders").where("collection", "=", collection).execute();
		for (const entry of removed) await recordEvents(client, qSchema, site, entry, ["deleted"]);

		return {
			collection,
			entries: counts?.entries ?? 0,
			trashed: counts?.trashed ?? 0,
			translations: counts?.translations ?? 0,
			folders: counts?.folders ?? 0,
			addresses: counts?.addresses ?? 0,
		};
	};

	return {
		readSchemaState: async () => {
			let rows: { schema: JsonObject; applied_at: Date }[];
			try {
				rows = await db.selectFrom("schema_state").select(["schema", "applied_at"]).execute();
			} catch (error) {
				// A store that was not migrated to the step that creates the table has recorded nothing.
				if ((error as { code?: string }).code === "42P01") return null;
				throw error;
			}
			const row = rows[0];
			return row ? { schema: row.schema, appliedAt: row.applied_at } : null;
		},

		appliedSchemaTransforms: async (ids) => {
			if (ids.length === 0) return [];
			try {
				const rows = await db
					.selectFrom("cms_migrations")
					.select("name")
					.where("name", "=", sql<string>`any(${ids.map(recordName)}::text[])`)
					.execute();
				const done = new Set(rows.map((row) => row.name));
				return ids.filter((id) => done.has(recordName(id)));
			} catch (error) {
				if ((error as { code?: string }).code === "42P01") return [];
				throw error;
			}
		},

		scanBodies: async (params) => {
			const limit = params?.limit ?? DEFAULT_BATCH_SIZE;
			const rows = await readBatch(db, {
				collections: params?.collections,
				after: params?.after,
				limit,
			});
			const last = rows[rows.length - 1];
			return {
				bodies: rows.map(toScanned),
				next: last && rows.length === limit ? { entryId: last.entry_id, state: last.state } : null,
			};
		},

		collectionFootprint: async ({ collections, detail, sampleSize }) => {
			if (collections.length === 0) return {};
			const counts = await readFootprintCounts(db, collections);
			const result: Record<string, CollectionFootprint> = {};
			for (const collection of collections) {
				const base = counts.get(collection) as Omit<CollectionFootprint, "incoming">;
				if (!detail) {
					result[collection] = base;
					continue;
				}
				const relations = await readRelationReferrers(db, collection, sampleSize ?? 5);
				const links = await db
					.selectFrom("entry_references as r")
					.innerJoin("entries as t", "t.id", "r.target_entry_id")
					.innerJoin("entries as e", "e.id", "r.entry_id")
					.select(
						sql<string>`coalesce(sum((select count(*) from jsonb_array_elements(r.occurrences) o where o->>'type' <> 'metadata')), 0)`.as(
							"n",
						),
					)
					.where("t.collection", "=", collection)
					.where("e.collection", "<>", collection)
					.where("r.state", "=", "working")
					.executeTakeFirst();
				result[collection] = {
					...base,
					incoming: { relations: relations.count, sample: relations.sample, bodyLinks: Number(links?.n ?? 0) },
				};
			}
			return result;
		},

		applySchemaChange: async (params) => {
			try {
				return await withTrx(ctx, async (trx, client) => {
					await prepare(client, ctx.qSchema);
					const recorded = (
						await trx
							.selectFrom("cms_migrations")
							.select("name")
							.where("name", "=", sql<string>`any(${params.transformIds.map(recordName)}::text[])`)
							.execute()
					).map((row) => row.name);
					const done = new Set(recorded);
					const pending = params.transformIds.filter((id) => !done.has(recordName(id)));
					const skipped = params.transformIds.filter((id) => done.has(recordName(id)));

					const changed: Record<string, { entries: number; bodies: number }> = {};
					for (const id of pending) changed[id] = { entries: 0, bodies: 0 };
					const lastEntry = new Map<string, string>();
					let bodies = 0;
					let entries = 0;
					let lastRewritten: string | undefined;

					if (pending.length > 0 && params.collections.length > 0) {
						let after: { entryId: string; state: string } | undefined;
						for (;;) {
							const rows = await readBatch(trx, {
								collections: params.collections,
								after,
								limit: DEFAULT_BATCH_SIZE,
								lock: true,
							});
							if (rows.length === 0) break;
							for (const row of rows) {
								const result = await params.rewrite(toScanned(row), pending);
								if (!result) continue;
								await trx
									.updateTable("entry_bodies")
									.set({
										metadata: JSON.stringify(result.metadata),
										doc: JSON.stringify(result.doc),
										content_hash: result.contentHash,
										doc_key_hash: documentKeyHash(result.doc),
										search_text: extractVisibleText(site, result.doc),
									})
									.where("entry_id", "=", row.entry_id)
									.where("state", "=", row.state)
									.execute();
								await replaceMetadataReferences(trx, row.entry_id, row.state, result.references);
								bodies += 1;
								if (lastRewritten !== row.entry_id) entries += 1;
								lastRewritten = row.entry_id;
								for (const id of result.changedBy) {
									const count = changed[id];
									if (!count) continue;
									count.bodies += 1;
									if (lastEntry.get(id) !== row.entry_id) count.entries += 1;
									lastEntry.set(id, row.entry_id);
								}
							}
							const last = rows[rows.length - 1];
							if (!last || rows.length < DEFAULT_BATCH_SIZE) break;
							after = { entryId: last.entry_id, state: last.state };
						}
					}

					// A dropped collection's rows are deleted, not rewritten; it runs after the rewrites so the transforms of other collections see the entries they expect.
					const dropped: DroppedCollection[] = [];
					for (const item of params.dropCollections ?? []) {
						if (!pending.includes(item.id)) continue;
						dropped.push(await dropCollectionRows(trx, client, item.collection));
					}

					for (const id of pending) {
						await trx
							.insertInto("cms_migrations")
							.values({ name: recordName(id) })
							.execute();
					}
					await trx
						.insertInto("schema_state")
						.values({
							id: true,
							schema: JSON.stringify(params.schema),
							applied_at: sql<Date>`now()`,
						})
						.onConflict((conflict) =>
							conflict.column("id").doUpdateSet((eb) => ({
								schema: eb.ref("excluded.schema"),
								applied_at: eb.ref("excluded.applied_at"),
							})),
						)
						.execute();

					const report = {
						applied: pending,
						skipped,
						changed,
						dropped,
						bodies,
						entries,
						dryRun: Boolean(params.dryRun),
					};
					if (params.dryRun) throw Object.assign(new DryRunRollback(), { report });
					return report;
				});
			} catch (error) {
				if (error instanceof DryRunRollback) {
					return (error as unknown as { report: Awaited<ReturnType<SchemaChangeStore["applySchemaChange"]>> }).report;
				}
				throw error;
			}
		},
	};
}
