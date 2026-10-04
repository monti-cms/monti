import { randomUUID } from "node:crypto";
import { type StoreContext, withTransaction } from "./context";
import { CmsError } from "./errors";
import { MEDIA_COLUMNS, type MediaRow, mapMediaRow } from "./rows";
import { likeContainsPattern, likePrefixPattern } from "./sql";
import type {
	CompleteMediaAssetInput,
	CreateMediaAssetInput,
	ListMediaItem,
	ListMediaParams,
	ListMediaResult,
	MediaAssetRecord,
	MediaReferenceItem,
} from "./types";

/** §7 미디어 메타데이터. 파일 자체는 `MediaStore`(R2)가 다룬다. */
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

		/** 라이브러리의 기본 alt·caption. 삽입할 때만 복사하므로 이미 쓴 본문은 바뀌지 않는다(§7.3). */
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

		/** §7.3 라이브러리: 완료·삭제 중 파일만 보인다. 업로드 대기 파일은 정리 작업의 대상이다. */
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
			// `image/`처럼 앞부분만 줘도 걸러지도록 접두어로 비교한다.
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
		 * 삭제 1단계(§7.3): 사용 중이 아닌지 확인하고 `deleting`으로 바꾼다. 파일 삭제가 끝나면
		 * {@link finalizeMediaDelete}로 행을 지운다. 저장소 삭제가 실패해도 `deleting` 행이 남아 다시 시도할 수 있다.
		 *
		 * 참조 인덱스 외에 본문 원문·메타데이터와 템플릿도 본다 — 해석하지 못한 초안이나 템플릿이 이 미디어를 쓰면
		 * 사용 여부를 확정할 수 없으므로 삭제를 보류한다. 메타데이터는 미디어 필드(`fields.media`)를 두기 전에 저장해
		 * 참조 인덱스에 아직 없는 값(텍스트 필드에 두던 미디어 ID)도 지우지 않게 한다.
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
					   (SELECT COUNT(*) FROM "${qSchema}".body_templates WHERE position($1 in mdx) > 0)::text AS templates`,
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

		/** 삭제 2단계: 파일 삭제를 확인한 뒤 행을 지운다. */
		finalizeMediaDelete: async (id: string): Promise<void> => {
			await pool.query(
				`DELETE FROM "${qSchema}".media_assets WHERE id = $1 AND status IN ('deleting', 'pending', 'failed')`,
				[id],
			);
		},

		/** §7.2 정리 대상: 기준 시각보다 오래된 미완료(`pending`)·실패(`failed`) 업로드. */
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
