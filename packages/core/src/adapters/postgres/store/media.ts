import { randomUUID } from "node:crypto";
import { sql } from "kysely";
import { MEDIA_FOLDER_SCOPE } from "../../../core/collections";
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
import type { StoreContext } from "./context";
import { assertFolderTarget } from "./folders";
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
			await assertFolderTarget(db, site, input.folderId, MEDIA_FOLDER_SCOPE);
			const now = new Date();
			const row = await db
				.insertInto("media_assets")
				.values({
					id: input.id ?? randomUUID(),
					folder_id: input.folderId ?? null,
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
			folderId?: string | null;
		}): Promise<MediaAssetRecord> => {
			await assertFolderTarget(db, site, params.folderId, MEDIA_FOLDER_SCOPE);
			const setValues: Record<string, unknown> = {
				updated_at: sql<Date>`now()`,
			};
			if (params.defaultAlt !== undefined) {
				setValues.default_alt = params.defaultAlt;
			}
			if (params.defaultCaption !== undefined) {
				setValues.default_caption = params.defaultCaption;
			}
			if (params.filename !== undefined) {
				setValues.filename = params.filename.normalize("NFC");
			}
			if (params.folderId !== undefined) {
				setValues.folder_id = params.folderId;
			}
			const row = await db
				.updateTable("media_assets")
				.set(setValues)
				.where("id", "=", params.id)
				.where("status", "=", "ready")
				.returning(MEDIA_COLUMN_NAMES)
				.executeTakeFirst();
			if (!row) throw new CmsError("Media asset not found", "not_found");
			return mapMediaRow(row);
		},

		/** Library: only completed and deleting files are shown. Files waiting for upload are targets of the cleanup job; files in the trash are read through the trash. */
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
			if (params.folderId === null) {
				grouped = grouped.where("m.folder_id", "is", null);
			} else if (params.folderId !== undefined) {
				const folderId = params.folderId;
				grouped = grouped.where(
					params.includeDescendants
						? sql<boolean>`m.folder_id in (
							with recursive descendants as (
								select id from ${sql.id(qSchema, "folders")} where id = ${folderId}
								union all
								select f.id from ${sql.id(qSchema, "folders")} f join descendants d on f.parent_id = d.id
							)
							select id from descendants
						)`
						: (eb) => eb("m.folder_id", "=", folderId),
				);
			}
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
		 * Removes the row of a media file after its stored files were deleted: a file that was permanently deleted from the trash (`trashed`), an upload
		 * that never finished (`pending`, `failed`) or a delete that was left half done (`deleting`).
		 */
		finalizeMediaDelete: async (id: string): Promise<void> => {
			await db
				.deleteFrom("media_assets")
				.where("id", "=", id)
				.where("status", "in", ["trashed", "deleting", "pending", "failed"])
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
