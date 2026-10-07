import { isDeepStrictEqual } from "node:util";
import { sql } from "kysely";
import type { SchemaChangeStore } from "../../../core/store/ports";
import type { ScannedBody } from "../../../core/store/schema-change";
import type { EntryMetadata, EntryStatus, JsonObject } from "../../../core/store/types";
import { readReferenceOccurrences } from "../../../core/types";
import type { Db } from "../db/kysely";
import { type StoreContext, withTrx } from "./context";
import { extractVisibleText, readBodyDoc } from "./rows";
import { prepare } from "./schema";

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
	mdx: string | null;
	schema_version: number;
}

const toScanned = (row: BodyScanRow): ScannedBody => ({
	entryId: row.entry_id,
	collection: row.collection,
	locale: row.locale,
	isTranslation: row.is_translation,
	status: row.status,
	state: row.state,
	metadata: row.metadata,
	doc: readBodyDoc(row.doc, row.mdx),
	schemaVersion: row.schema_version,
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
			"b.mdx",
			"b.schema_version",
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

/** Thrown inside the transaction of a dry run to roll it back. */
class DryRunRollback extends Error {}

/** The schema-change part of the content store: reads the applied schema, scans bodies, and applies the transforms (`SchemaChangeStore`). */
export function createSchemaChangeOps(ctx: StoreContext): SchemaChangeStore {
	const { site } = ctx;
	const db = ctx.db();

	return {
		readSchemaState: async () => {
			let rows: { schema_version: number; schema: JsonObject; applied_at: Date }[];
			try {
				rows = await db.selectFrom("schema_state").select(["schema_version", "schema", "applied_at"]).execute();
			} catch (error) {
				// A store that was not migrated to the step that creates the table has recorded nothing.
				if ((error as { code?: string }).code === "42P01") return null;
				throw error;
			}
			const row = rows[0];
			return row ? { schemaVersion: row.schema_version, schema: row.schema, appliedAt: row.applied_at } : null;
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
										schema_version: params.schemaVersion,
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
							schema_version: params.schemaVersion,
							schema: JSON.stringify(params.schema),
							applied_at: sql<Date>`now()`,
						})
						.onConflict((conflict) =>
							conflict.column("id").doUpdateSet((eb) => ({
								schema_version: eb.ref("excluded.schema_version"),
								schema: eb.ref("excluded.schema"),
								applied_at: eb.ref("excluded.applied_at"),
							})),
						)
						.execute();

					const report = { applied: pending, skipped, changed, bodies, entries, dryRun: Boolean(params.dryRun) };
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
