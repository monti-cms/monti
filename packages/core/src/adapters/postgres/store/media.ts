import { randomUUID } from "node:crypto";
import { sql } from "kysely";
import { CmsError } from "../../../core/store/errors";
import type {
	CompleteMediaAssetInput,
	CreateMediaAssetInput,
	ListMediaItem,
	ListMediaParams,
	ListMediaResult,
	MediaAssetRecord,
	MediaReferenceItem,
} from "../../../core/store/types";
import { type StoreContext, withTrx } from "./context";
import { MEDIA_COLUMN_NAMES, mapMediaRow } from "./rows";
import { likeContainsPattern, likePrefixPattern } from "./sql";
import { ROW_COLLECTION, titleExpr } from "./title-sql";

/** `MEDIA_COLUMN_NAMES` as columns of the alias `m` (`listMediaAssets`). */
const MEDIA_COLUMNS_OF_M = MEDIA_COLUMN_NAMES.map((column) => `m.${column}` as const);

/** Media metadata. The file itself is handled by `MediaStore` (R2). */
export function createMediaOps(ctx: StoreContext) {
	const { qSchema, site } = ctx;
	const db = ctx.db();

	const getMediaAsset = async (id: string): Promise<MediaAssetRecord | null> => {
		const row = await db.selectFrom("media_assets").select(MEDIA_COLUMN_NAMES).where("id", "=", id).executeTakeFirst();
		return row ? mapMediaRow(row) : null;
	};

	return {
		createMediaAsset: async (input: CreateMediaAssetInput): Promise<MediaAssetRecord> => {
			const now = new Date();
			const row = await db
				.insertInto("media_assets")
				.values({
					id: input.id ?? randomUUID(),
					status: "pending",
					filename: input.filename,
					mime_type: input.mimeType,
					byte_size: input.byteSize,
					staging_key: input.stagingKey,
					original_staging_key: input.original?.stagingKey ?? null,
					original_mime_type: input.original?.mimeType ?? null,
					original_byte_size: input.original?.byteSize ?? null,
					created_at: now,
					updated_at: now,
				})
				.returning(MEDIA_COLUMN_NAMES)
				.executeTakeFirstOrThrow();
			return mapMediaRow(row);
		},

		getMediaAsset,

		findReadyMediaByStorageKeys: async (params: {
			keys: readonly string[];
		}): Promise<{ id: string; storageKey: string }[]> => {
			if (params.keys.length === 0) return [];
			const rows = await db
				.selectFrom("media_assets")
				.select(["id", "storage_key"])
				.where("status", "=", "ready")
				.where("storage_key", "=", sql<string>`any(${[...params.keys]}::text[])`)
				.execute();
			return rows.map((row) => ({ id: row.id, storageKey: row.storage_key as string }));
		},

		completeMediaAsset: async (input: CompleteMediaAssetInput): Promise<MediaAssetRecord> => {
			const now = new Date();
			const row = await db
				.updateTable("media_assets")
				.set({
					status: "ready",
					storage_key: input.storageKey,
					mime_type: input.mimeType,
					byte_size: input.byteSize,
					width: input.width,
					height: input.height,
					original_storage_key: input.original?.storageKey ?? null,
					original_mime_type: sql<string | null>`coalesce(${input.original?.mimeType ?? null}, original_mime_type)`,
					original_byte_size: sql<string | null>`coalesce(${input.original?.byteSize ?? null}, original_byte_size)`,
					original_width: input.original?.width ?? null,
					original_height: input.original?.height ?? null,
					updated_at: now,
					ready_at: now,
				})
				.where("id", "=", input.id)
				.returning(MEDIA_COLUMN_NAMES)
				.executeTakeFirst();
			if (!row) throw new CmsError("Media asset not found", "not_found");
			return mapMediaRow(row);
		},

		failMediaAsset: async (id: string): Promise<void> => {
			await db
				.updateTable("media_assets")
				.set({ status: "failed", updated_at: sql<Date>`now()` })
				.where("id", "=", id)
				.execute();
		},

		/** The library's default alt and caption. They are copied only on insert, so bodies already written do not change. */
		updateMediaMetadata: async (params: {
			id: string;
			filename?: string;
			defaultAlt?: string;
			defaultCaption?: string;
		}): Promise<MediaAssetRecord> => {
			const row = await db
				.updateTable("media_assets")
				.set({
					default_alt: sql<string>`coalesce(${params.defaultAlt ?? null}, default_alt)`,
					default_caption: sql<string>`coalesce(${params.defaultCaption ?? null}, default_caption)`,
					filename: sql<string>`coalesce(${params.filename?.normalize("NFC") ?? null}, filename)`,
					updated_at: sql<Date>`now()`,
				})
				.where("id", "=", params.id)
				.where("status", "=", "ready")
				.returning(MEDIA_COLUMN_NAMES)
				.executeTakeFirst();
			if (!row) throw new CmsError("Media asset not found", "not_found");
			return mapMediaRow(row);
		},

		/** Library: only completed and deleting files are shown. Files waiting for upload are targets of the cleanup job. */
		listMediaAssets: async (params: ListMediaParams = {}): Promise<ListMediaResult> => {
			const page = Math.max(1, params.page || 1);
			const pageSize = Math.max(1, Math.min(params.pageSize || 25, 100));

			let grouped = db
				.selectFrom("media_assets as m")
				.leftJoin("entry_references as r", (join) =>
					join.on("r.kind", "=", "media").onRef("r.target_media_id", "=", "m.id"),
				)
				.leftJoin("entries as e", "e.id", "r.entry_id")
				.leftJoin("entry_bodies as eb", (join) =>
					join.onRef("eb.entry_id", "=", "r.entry_id").onRef("eb.state", "=", "r.state"),
				)
				.where("m.status", "in", ["ready", "deleting"])
				.groupBy("m.id");
			if (params.search?.trim()) {
				grouped = grouped.where("m.filename", "ilike", likeContainsPattern(params.search.trim()));
			}
			// Compare by prefix so that giving only the leading part, such as `image/`, still filters.
			if (params.mimeType?.trim()) {
				grouped = grouped.where("m.mime_type", "like", likePrefixPattern(params.mimeType.trim()));
			}
			if (params.kind === "image") grouped = grouped.where("m.mime_type", "like", "image/%");
			if (params.kind === "file") {
				grouped = grouped.where((eb) =>
					eb.or([eb("m.mime_type", "is", null), eb("m.mime_type", "not like", "image/%")]),
				);
			}
			if (params.uploadedFrom) grouped = grouped.where("m.created_at", ">=", params.uploadedFrom);
			if (params.uploadedTo) grouped = grouped.where("m.created_at", "<=", params.uploadedTo);
			if (params.used === "used") grouped = grouped.having((eb) => eb(eb.fn.count("r.entry_id"), ">", 0));
			if (params.used === "unused") grouped = grouped.having((eb) => eb(eb.fn.count("r.entry_id"), "=", 0));

			const count = await db
				.selectFrom(grouped.select("m.id").as("sub"))
				.select((eb) => eb.fn.countAll<string>().as("count"))
				.executeTakeFirst();
			const rows = await grouped
				.select(MEDIA_COLUMNS_OF_M)
				.select((eb) => [
					sql<string>`${eb.fn.count("r.entry_id")}::text`.as("ref_count"),
					sql<MediaReferenceItem[] | null>`coalesce(json_agg(json_build_object(
						'entryId', r.entry_id, 'state', r.state, 'collection', e.collection, 'title', ${titleExpr(site, "eb.metadata", ROW_COLLECTION)}
					)) filter (where r.entry_id is not null), '[]')`.as("references_json"),
				])
				.orderBy("m.created_at", "desc")
				.orderBy("m.id", "desc")
				.limit(pageSize)
				.offset((page - 1) * pageSize)
				.execute();

			const items: ListMediaItem[] = rows.map((row) => ({
				...mapMediaRow(row),
				referencesCount: Number(row.ref_count),
				references: row.references_json ?? [],
			}));
			return { items, total: Number(count?.count ?? 0), page, pageSize };
		},

		/**
		 * Delete step 1: checks the media is not in use and sets it to `deleting`. When the file deletion finishes,
		 * {@link finalizeMediaDelete} removes the row. If storage deletion fails, the `deleting` row remains so it can be retried.
		 *
		 * Besides the reference index, it also checks raw bodies, metadata, and templates: if an unparsed draft or template uses this media,
		 * usage cannot be confirmed, so deletion is held. Metadata saved before media fields (`fields.media`) existed is checked too,
		 * so values not yet in the reference index (media IDs kept in text fields) are not deleted.
		 */
		beginMediaDelete: async (id: string): Promise<MediaAssetRecord> =>
			withTrx(ctx, async (trx) => {
				const row = await trx
					.selectFrom("media_assets")
					.select(MEDIA_COLUMN_NAMES)
					.where("id", "=", id)
					.forUpdate()
					.executeTakeFirst();
				if (!row) throw new CmsError("Media asset not found", "not_found");

				const refs = await trx
					.selectFrom("entry_references")
					.select((eb) => eb.fn.countAll<string>().as("count"))
					.where("kind", "=", "media")
					.where("target_media_id", "=", id)
					.executeTakeFirst();
				const mentions = await sql<{ count: string; templates: string }>`
					select
					  (select count(*) from ${sql.id(qSchema, "entry_bodies")}
					    where position(${id} in doc::text) > 0 or position(${id} in metadata::text) > 0)::text as count,
					  (select count(*) from ${sql.id(qSchema, "body_templates")} where position(${id} in doc::text) > 0)::text as templates`.execute(
					trx,
				);
				const referenceCount = Number(refs?.count ?? 0);
				const bodyMentions = Number(mentions.rows[0]?.count ?? 0);
				const templateMentions = Number(mentions.rows[0]?.templates ?? 0);
				if (referenceCount > 0 || bodyMentions > 0 || templateMentions > 0) {
					throw new CmsError("Media asset is in use", "in_use", undefined, {
						references: referenceCount,
						bodies: bodyMentions,
						templates: templateMentions,
					});
				}

				const updated = await trx
					.updateTable("media_assets")
					.set({ status: "deleting", updated_at: sql<Date>`now()` })
					.where("id", "=", id)
					.returning(MEDIA_COLUMN_NAMES)
					.executeTakeFirstOrThrow();
				return mapMediaRow(updated);
			}),

		/** Delete step 2: removes the row after confirming the file was deleted. */
		finalizeMediaDelete: async (id: string): Promise<void> => {
			await db
				.deleteFrom("media_assets")
				.where("id", "=", id)
				.where("status", "in", ["deleting", "pending", "failed"])
				.execute();
		},

		/** Cleanup targets: incomplete (`pending`) and failed (`failed`) uploads older than the cutoff time. */
		listStaleUploads: async (params: { before: Date }): Promise<MediaAssetRecord[]> => {
			const rows = await db
				.selectFrom("media_assets")
				.select(MEDIA_COLUMN_NAMES)
				.where("status", "in", ["pending", "failed"])
				.where("created_at", "<", params.before)
				.orderBy("created_at", "asc")
				.limit(500)
				.execute();
			return rows.map(mapMediaRow);
		},
	};
}
