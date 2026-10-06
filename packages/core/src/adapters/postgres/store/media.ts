import { randomUUID } from "node:crypto";
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
import { type StoreContext, withTransaction } from "./context";
import { MEDIA_COLUMNS, type MediaRow, mapMediaRow } from "./rows";
import { likeContainsPattern, likePrefixPattern } from "./sql";

/** Media metadata. The file itself is handled by `MediaStore` (R2). */
export function createMediaOps(ctx: StoreContext) {
	const { pool, qSchema } = ctx;

	const getMediaAsset = async (id: string): Promise<MediaAssetRecord | null> => {
		const res = await pool.query<MediaRow>(`SELECT ${MEDIA_COLUMNS} FROM "${qSchema}".media_assets WHERE id = $1`, [
			id,
		]);
		return res.rows[0] ? mapMediaRow(res.rows[0]) : null;
	};

	return {
		createMediaAsset: async (input: CreateMediaAssetInput): Promise<MediaAssetRecord> => {
			const now = new Date();
			const res = await pool.query<MediaRow>(
				`INSERT INTO "${qSchema}".media_assets
				 (id, status, filename, mime_type, byte_size, staging_key, original_staging_key, original_mime_type, original_byte_size, created_at, updated_at)
				 VALUES ($1, 'pending', $2, $3, $4, $5, $6, $7, $8, $9, $9)
				 RETURNING ${MEDIA_COLUMNS}`,
				[
					input.id ?? randomUUID(),
					input.filename,
					input.mimeType,
					input.byteSize,
					input.stagingKey,
					input.original?.stagingKey ?? null,
					input.original?.mimeType ?? null,
					input.original?.byteSize ?? null,
					now,
				],
			);
			return mapMediaRow(res.rows[0] as MediaRow);
		},

		getMediaAsset,

		findReadyMediaByStorageKeys: async (params: {
			keys: readonly string[];
		}): Promise<{ id: string; storageKey: string }[]> => {
			if (params.keys.length === 0) return [];
			const res = await pool.query<{ id: string; storage_key: string }>(
				`SELECT id, storage_key FROM "${qSchema}".media_assets WHERE status = 'ready' AND storage_key = ANY($1::text[])`,
				[[...params.keys]],
			);
			return res.rows.map((row) => ({ id: row.id, storageKey: row.storage_key }));
		},

		completeMediaAsset: async (input: CompleteMediaAssetInput): Promise<MediaAssetRecord> => {
			const now = new Date();
			const res = await pool.query<MediaRow>(
				`UPDATE "${qSchema}".media_assets
				 SET status = 'ready', storage_key = $1, mime_type = $2, byte_size = $3, width = $4, height = $5,
				     original_storage_key = $6, original_mime_type = COALESCE($7, original_mime_type),
				     original_byte_size = COALESCE($8, original_byte_size), original_width = $9, original_height = $10,
				     updated_at = $11, ready_at = $11
				 WHERE id = $12
				 RETURNING ${MEDIA_COLUMNS}`,
				[
					input.storageKey,
					input.mimeType,
					input.byteSize,
					input.width,
					input.height,
					input.original?.storageKey ?? null,
					input.original?.mimeType ?? null,
					input.original?.byteSize ?? null,
					input.original?.width ?? null,
					input.original?.height ?? null,
					now,
					input.id,
				],
			);
			if (!res.rows[0]) throw new CmsError("Media asset not found", "not_found");
			return mapMediaRow(res.rows[0]);
		},

		failMediaAsset: async (id: string): Promise<void> => {
			await pool.query(`UPDATE "${qSchema}".media_assets SET status = 'failed', updated_at = NOW() WHERE id = $1`, [
				id,
			]);
		},

		/** The library's default alt and caption. They are copied only on insert, so bodies already written do not change. */
		updateMediaMetadata: async (params: {
			id: string;
			filename?: string;
			defaultAlt?: string;
			defaultCaption?: string;
		}): Promise<MediaAssetRecord> => {
			const res = await pool.query<MediaRow>(
				`UPDATE "${qSchema}".media_assets
				 SET default_alt = COALESCE($2, default_alt), default_caption = COALESCE($3, default_caption),
				     filename = COALESCE($4, filename), updated_at = NOW()
				 WHERE id = $1 AND status = 'ready'
				 RETURNING ${MEDIA_COLUMNS}`,
				[
					params.id,
					params.defaultAlt ?? null,
					params.defaultCaption ?? null,
					params.filename?.normalize("NFC") ?? null,
				],
			);
			if (!res.rows[0]) throw new CmsError("Media asset not found", "not_found");
			return mapMediaRow(res.rows[0]);
		},

		/** Library: only completed and deleting files are shown. Files waiting for upload are targets of the cleanup job. */
		listMediaAssets: async (params: ListMediaParams = {}): Promise<ListMediaResult> => {
			const page = Math.max(1, params.page || 1);
			const pageSize = Math.max(1, Math.min(params.pageSize || 25, 100));
			const values: unknown[] = [];
			const bind = (value: unknown) => {
				values.push(value);
				return `$${values.length}`;
			};

			const conditions = ["m.status IN ('ready', 'deleting')"];
			if (params.search?.trim()) conditions.push(`m.filename ILIKE ${bind(likeContainsPattern(params.search.trim()))}`);
			// Compare by prefix so that giving only the leading part, such as `image/`, still filters.
			if (params.mimeType?.trim())
				conditions.push(`m.mime_type LIKE ${bind(likePrefixPattern(params.mimeType.trim()))}`);
			if (params.kind === "image") conditions.push("m.mime_type LIKE 'image/%'");
			if (params.kind === "file") conditions.push("(m.mime_type IS NULL OR m.mime_type NOT LIKE 'image/%')");
			if (params.uploadedFrom) conditions.push(`m.created_at >= ${bind(params.uploadedFrom)}`);
			if (params.uploadedTo) conditions.push(`m.created_at <= ${bind(params.uploadedTo)}`);
			const having =
				params.used === "used"
					? "HAVING COUNT(r.entry_id) > 0"
					: params.used === "unused"
						? "HAVING COUNT(r.entry_id) = 0"
						: "";

			const grouped = `
				FROM "${qSchema}".media_assets m
				LEFT JOIN "${qSchema}".entry_references r ON r.kind = 'media' AND r.target_media_id = m.id
				LEFT JOIN "${qSchema}".entries e ON e.id = r.entry_id
				LEFT JOIN "${qSchema}".entry_bodies eb ON eb.entry_id = r.entry_id AND eb.state = r.state
				WHERE ${conditions.join(" AND ")}
				GROUP BY m.id
				${having}`;

			const countRes = await pool.query<{ count: string }>(
				`SELECT COUNT(*)::text AS count FROM (SELECT m.id ${grouped}) sub`,
				values,
			);
			const res = await pool.query<MediaRow & { ref_count: string; references_json: MediaReferenceItem[] }>(
				`SELECT ${MEDIA_COLUMNS.split(",")
					.map((column) => `m.${column.trim()}`)
					.join(", ")},
					COUNT(r.entry_id)::text AS ref_count,
					COALESCE(json_agg(json_build_object(
						'entryId', r.entry_id, 'state', r.state, 'collection', e.collection, 'title', eb.metadata->>'title'
					)) FILTER (WHERE r.entry_id IS NOT NULL), '[]') AS references_json
				 ${grouped}
				 ORDER BY m.created_at DESC, m.id DESC
				 LIMIT ${bind(pageSize)} OFFSET ${bind((page - 1) * pageSize)}`,
				values,
			);

			const items: ListMediaItem[] = res.rows.map((row) => ({
				...mapMediaRow(row),
				referencesCount: Number(row.ref_count),
				references: row.references_json ?? [],
			}));
			return { items, total: Number(countRes.rows[0]?.count ?? 0), page, pageSize };
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
			withTransaction(pool, async (client) => {
				const res = await client.query<MediaRow>(
					`SELECT ${MEDIA_COLUMNS} FROM "${qSchema}".media_assets WHERE id = $1 FOR UPDATE`,
					[id],
				);
				const row = res.rows[0];
				if (!row) throw new CmsError("Media asset not found", "not_found");

				const refs = await client.query<{ count: string }>(
					`SELECT COUNT(*)::text AS count FROM "${qSchema}".entry_references WHERE kind = 'media' AND target_media_id = $1`,
					[id],
				);
				const mentions = await client.query<{ count: string; templates: string }>(
					`SELECT
					   (SELECT COUNT(*) FROM "${qSchema}".entry_bodies
					     WHERE position($1 in mdx) > 0 OR position($1 in metadata::text) > 0)::text AS count,
					   (SELECT COUNT(*) FROM "${qSchema}".body_templates WHERE position($1 in doc::text) > 0)::text AS templates`,
					[id],
				);
				const referenceCount = Number(refs.rows[0]?.count ?? 0);
				const bodyMentions = Number(mentions.rows[0]?.count ?? 0);
				const templateMentions = Number(mentions.rows[0]?.templates ?? 0);
				if (referenceCount > 0 || bodyMentions > 0 || templateMentions > 0) {
					throw new CmsError("Media asset is in use", "in_use", undefined, {
						references: referenceCount,
						bodies: bodyMentions,
						templates: templateMentions,
					});
				}

				const updated = await client.query<MediaRow>(
					`UPDATE "${qSchema}".media_assets SET status = 'deleting', updated_at = NOW() WHERE id = $1 RETURNING ${MEDIA_COLUMNS}`,
					[id],
				);
				return mapMediaRow(updated.rows[0] as MediaRow);
			}),

		/** Delete step 2: removes the row after confirming the file was deleted. */
		finalizeMediaDelete: async (id: string): Promise<void> => {
			await pool.query(
				`DELETE FROM "${qSchema}".media_assets WHERE id = $1 AND status IN ('deleting', 'pending', 'failed')`,
				[id],
			);
		},

		/** Cleanup targets: incomplete (`pending`) and failed (`failed`) uploads older than the cutoff time. */
		listStaleUploads: async (params: { before: Date }): Promise<MediaAssetRecord[]> => {
			const res = await pool.query<MediaRow>(
				`SELECT ${MEDIA_COLUMNS} FROM "${qSchema}".media_assets
				 WHERE status IN ('pending', 'failed') AND created_at < $1 ORDER BY created_at ASC LIMIT 500`,
				[params.before],
			);
			return res.rows.map(mapMediaRow);
		},
	};
}
