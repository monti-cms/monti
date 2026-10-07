import { isDeepStrictEqual } from "node:util";
import type { PoolClient } from "pg";
import type { SchemaChangeStore } from "../../../core/store/ports";
import type { ScannedBody } from "../../../core/store/schema-change";
import type { EntryMetadata, EntryStatus, JsonObject } from "../../../core/store/types";
import { readReferenceOccurrences } from "../../../core/types";
import { type Queryable, type StoreContext, withTransaction } from "./context";
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
	client: Queryable,
	qSchema: string,
	params: {
		collections?: readonly string[];
		after?: { entryId: string; state: string };
		limit: number;
		lock?: boolean;
	},
): Promise<BodyScanRow[]> {
	const res = await client.query<BodyScanRow>(
		`SELECT b.entry_id, e.collection, e.locale, (e.translation_group_id IS NOT NULL AND e.translation_group_id <> e.id) AS is_translation, e.status, b.state, b.metadata, b.doc, b.mdx, b.schema_version
		 FROM "${qSchema}".entry_bodies b JOIN "${qSchema}".entries e ON e.id = b.entry_id
		 WHERE ($1::text[] IS NULL OR e.collection = ANY($1::text[]))
		   AND ($2::uuid IS NULL OR (b.entry_id, b.state) > ($2::uuid, $3::text))
		 ORDER BY b.entry_id, b.state LIMIT $4${params.lock ? " FOR UPDATE OF b" : ""}`,
		[params.collections ?? null, params.after?.entryId ?? null, params.after?.state ?? null, params.limit],
	);
	return res.rows;
}

/**
 * Replaces the metadata references of one stored body and leaves its body references as they are. A reference keeps its stale flag; it is dropped when no
 * occurrence is left. Occurrences are written metadata first and body after, the order a save writes them, so a later identical save sees nothing to change.
 */
async function replaceMetadataReferences(
	client: PoolClient,
	qSchema: string,
	entryId: string,
	state: "working" | "published",
	metadataReferences: readonly {
		readonly kind: "entry" | "media";
		readonly targetId: string;
		readonly occurrences: readonly unknown[];
	}[],
): Promise<void> {
	const current = (
		await client.query<{ kind: string; target_id: string; is_stale: boolean; occurrences: unknown }>(
			`SELECT kind, target_id, is_stale, occurrences FROM "${qSchema}".entry_references WHERE entry_id = $1 AND state = $2`,
			[entryId, state],
		)
	).rows;
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

	await client.query(`DELETE FROM "${qSchema}".entry_references WHERE entry_id = $1 AND state = $2`, [entryId, state]);
	for (const entry of next.values()) {
		const isMedia = entry.kind === "media";
		await client.query(
			`INSERT INTO "${qSchema}".entry_references (entry_id, state, kind, target_id, target_entry_id, target_media_id, is_stale, occurrences)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
			[
				entryId,
				state,
				entry.kind,
				entry.targetId,
				isMedia ? null : entry.targetId,
				isMedia ? entry.targetId : null,
				entry.isStale,
				JSON.stringify(entry.occurrences),
			],
		);
	}
}

/** Thrown inside the transaction of a dry run to roll it back. */
class DryRunRollback extends Error {}

/** The schema-change part of the content store: reads the applied schema, scans bodies, and applies the transforms (`SchemaChangeStore`). */
export function createSchemaChangeOps(ctx: StoreContext): SchemaChangeStore {
	const { pool, qSchema, site } = ctx;

	return {
		readSchemaState: async () => {
			let rows: { schema_version: number; schema: JsonObject; applied_at: Date }[];
			try {
				rows = (
					await pool.query<{ schema_version: number; schema: JsonObject; applied_at: Date }>(
						`SELECT schema_version, schema, applied_at FROM "${qSchema}".schema_state`,
					)
				).rows;
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
				const res = await pool.query<{ name: string }>(
					`SELECT name FROM "${qSchema}".cms_migrations WHERE name = ANY($1::text[])`,
					[ids.map(recordName)],
				);
				const done = new Set(res.rows.map((row) => row.name));
				return ids.filter((id) => done.has(recordName(id)));
			} catch (error) {
				if ((error as { code?: string }).code === "42P01") return [];
				throw error;
			}
		},

		scanBodies: async (params) => {
			const limit = params?.limit ?? DEFAULT_BATCH_SIZE;
			const rows = await readBatch(pool, qSchema, {
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
				return await withTransaction(pool, async (client) => {
					await prepare(client, qSchema);
					const recorded = (
						await client.query<{ name: string }>(
							`SELECT name FROM "${qSchema}".cms_migrations WHERE name = ANY($1::text[])`,
							[params.transformIds.map(recordName)],
						)
					).rows.map((row) => row.name);
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
							const rows = await readBatch(client, qSchema, {
								collections: params.collections,
								after,
								limit: DEFAULT_BATCH_SIZE,
								lock: true,
							});
							if (rows.length === 0) break;
							for (const row of rows) {
								const result = await params.rewrite(toScanned(row), pending);
								if (!result) continue;
								await client.query(
									`UPDATE "${qSchema}".entry_bodies SET metadata = $3, doc = $4, content_hash = $5, schema_version = $6, search_text = $7
									 WHERE entry_id = $1 AND state = $2`,
									[
										row.entry_id,
										row.state,
										JSON.stringify(result.metadata),
										JSON.stringify(result.doc),
										result.contentHash,
										params.schemaVersion,
										extractVisibleText(site, result.doc),
									],
								);
								await replaceMetadataReferences(client, qSchema, row.entry_id, row.state, result.references);
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
						await client.query(`INSERT INTO "${qSchema}".cms_migrations (name) VALUES ($1)`, [recordName(id)]);
					}
					await client.query(
						`INSERT INTO "${qSchema}".schema_state (id, schema_version, schema, applied_at) VALUES (TRUE, $1, $2, NOW())
						 ON CONFLICT (id) DO UPDATE SET schema_version = EXCLUDED.schema_version, schema = EXCLUDED.schema, applied_at = EXCLUDED.applied_at`,
						[params.schemaVersion, JSON.stringify(params.schema)],
					);

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
