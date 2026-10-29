import { randomUUID } from "node:crypto";
import { sql } from "kysely";
import { MEDIA_FOLDER_SCOPE } from "../../../core/collections";
import { replaceMismatch } from "../../../core/domain/media";
import { CmsError } from "../../../core/store/errors";
import type {
	CompleteMediaAssetInput,
	CreateMediaAssetInput,
	ListMediaItem,
	ListMediaParams,
	ListMediaResult,
	MediaAssetRecord,
	MediaReferenceItem,
	ReleasedMediaFiles,
} from "../../../core/store/types";
import { readReferenceOccurrences } from "../../../core/types";
import { type StoreContext, withTrx } from "./context";
import { assertFolderTarget } from "./folders";
import { mediaInUse } from "./media-use";
import { MEDIA_COLUMN_NAMES, mapMediaRow } from "./rows";
import { likeContainsPattern, likePrefixPattern } from "./sql";
import { ROW_COLLECTION, titleExpr } from "./title-sql";

/** `MEDIA_COLUMN_NAMES` as columns of the alias `m` (`listMediaAssets`). */
const MEDIA_COLUMNS_OF_M = MEDIA_COLUMN_NAMES.map((column) => `m.${column}` as const);

/** A default alt that is empty or only white space, as a condition on the alias `m`. */
const ALT_IS_BLANK = sql<boolean>`m.default_alt ~ '^[[:space:]]*$'`;

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

		/**
		 * Library: only completed and deleting files are shown. Files waiting for upload are targets of the cleanup job; files in the trash are read through the trash.
		 * `kinds` and `alts` count the files of the same scope as the list, but ignore `kind` and `alt`, so a menu can show the number of every choice.
		 */
		listMediaAssets: async (params: ListMediaParams = {}): Promise<ListMediaResult> => {
			const page = Math.max(1, params.page || 1);
			const pageSize = Math.max(1, Math.min(params.pageSize || 25, 100));

			/** The files that match everything but `kind` and `alt`, one row each (grouped by file, with the references joined). */
			let scope = db
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
				scope = scope.where("m.folder_id", "is", null);
			} else if (params.folderId !== undefined) {
				const folderId = params.folderId;
				scope = scope.where(
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
				scope = scope.where("m.filename", "ilike", likeContainsPattern(params.search.trim()));
			}
			// Compare by prefix so that giving only the leading part, such as `image/`, still filters.
			if (params.mimeType?.trim()) {
				scope = scope.where("m.mime_type", "like", likePrefixPattern(params.mimeType.trim()));
			}
			if (params.uploadedFrom) scope = scope.where("m.created_at", ">=", params.uploadedFrom);
			if (params.uploadedTo) scope = scope.where("m.created_at", "<=", params.uploadedTo);
			if (params.used === "used") scope = scope.having((eb) => eb(eb.fn.count("r.entry_id"), ">", 0));
			if (params.used === "unused") scope = scope.having((eb) => eb(eb.fn.count("r.entry_id"), "=", 0));

			let grouped = scope;
			if (params.kind === "image") grouped = grouped.where("m.mime_type", "like", "image/%");
			if (params.kind === "file") {
				grouped = grouped.where((eb) =>
					eb.or([eb("m.mime_type", "is", null), eb("m.mime_type", "not like", "image/%")]),
				);
			}
			// Alt text only exists for images.
			if (params.alt === "none") grouped = grouped.where("m.mime_type", "like", "image/%").where(ALT_IS_BLANK);
			if (params.alt === "has")
				grouped = grouped.where("m.mime_type", "like", "image/%").where(sql<boolean>`not (${ALT_IS_BLANK})`);

			const count = await db
				.selectFrom(grouped.select("m.id").as("sub"))
				.select((eb) => eb.fn.countAll<string>().as("count"))
				.executeTakeFirst();
			const counts = await db
				.selectFrom(scope.select(["m.id", "m.mime_type", "m.default_alt"]).as("s"))
				.select([
					sql<string>`count(*) filter (where s.mime_type like 'image/%')`.as("image"),
					sql<string>`count(*) filter (where s.mime_type is null or s.mime_type not like 'image/%')`.as("file"),
					sql<string>`count(*) filter (where s.mime_type like 'image/%' and s.default_alt ~ '^[[:space:]]*$')`.as(
						"none",
					),
					sql<string>`count(*) filter (where s.mime_type like 'image/%' and s.default_alt !~ '^[[:space:]]*$')`.as(
						"has",
					),
				])
				.executeTakeFirst();
			const rows = await grouped
				.select(MEDIA_COLUMNS_OF_M)
				.select((eb) => [
					sql<string>`${eb.fn.count("r.entry_id")}::text`.as("ref_count"),
					sql<
						(Omit<MediaReferenceItem, "occurrences"> & { occurrences: unknown })[] | null
					>`coalesce(json_agg(json_build_object(
						'entryId', r.entry_id, 'state', r.state, 'collection', e.collection, 'title', ${titleExpr(site, "eb.metadata", ROW_COLLECTION)},
						'occurrences', r.occurrences
					)) filter (where r.entry_id is not null), '[]')`.as("references_json"),
				])
				.$call((query) => {
					switch (params.sort) {
						case "uploadedAsc":
							return query.orderBy("m.created_at", "asc").orderBy("m.id", "asc");
						case "name":
							return query.orderBy(sql`lower(m.filename)`, "asc").orderBy("m.id", "asc");
						case "size":
							return query.orderBy(sql`m.byte_size desc nulls last`).orderBy("m.id", "desc");
						default:
							return query.orderBy("m.created_at", "desc").orderBy("m.id", "desc");
					}
				})
				.limit(pageSize)
				.offset((page - 1) * pageSize)
				.execute();

			const items: ListMediaItem[] = rows.map((row) => ({
				...mapMediaRow(row),
				referencesCount: Number(row.ref_count),
				references: (row.references_json ?? []).map((reference) => ({
					...reference,
					occurrences: readReferenceOccurrences(reference.occurrences),
				})),
			}));
			return {
				items,
				total: Number(count?.count ?? 0),
				page,
				pageSize,
				kinds: { image: Number(counts?.image ?? 0), file: Number(counts?.file ?? 0) },
				alts: { none: Number(counts?.none ?? 0), has: Number(counts?.has ?? 0) },
			};
		},

		replaceMediaFile: async (params: {
			id: string;
			fromId: string;
		}): Promise<{ media: MediaAssetRecord; released: ReleasedMediaFiles }> => {
			if (params.id === params.fromId) throw new CmsError("A media file cannot replace itself", "invalid_input");
			return withTrx(ctx, async (trx) => {
				// Locked in id order, so two replaces that name the same files cannot wait on each other.
				const rows = await trx
					.selectFrom("media_assets")
					.select(MEDIA_COLUMN_NAMES)
					.where("id", "in", [params.id, params.fromId])
					.orderBy("id")
					.forUpdate()
					.execute();
				const target = rows.find((row) => row.id === params.id);
				const source = rows.find((row) => row.id === params.fromId);
				if (!target || target.status !== "ready") throw new CmsError("Media asset not found", "not_found");
				if (!source || source.status !== "ready") throw new CmsError("Replacement media asset not found", "not_found");
				const mismatch = replaceMismatch(target.mime_type, source.mime_type);
				if (mismatch) {
					throw new CmsError("The replacement is not the same kind of file", "unsupported_media_type", {
						notice: { key: mismatch },
					});
				}
				// A file that something refers to cannot give its stored file away; the reference would lose its file.
				if ((await mediaInUse(trx, qSchema, [params.fromId])).size > 0) {
					throw new CmsError("The replacement media asset is in use", "conflict");
				}
				// The row goes first: it frees the storage key before the target takes it.
				await trx.deleteFrom("media_assets").where("id", "=", params.fromId).execute();
				const row = await trx
					.updateTable("media_assets")
					.set({
						storage_key: source.storage_key,
						mime_type: source.mime_type,
						byte_size: source.byte_size,
						width: source.width,
						height: source.height,
						original_storage_key: source.original_storage_key,
						// The staged original of the old file is gone; a leftover key would show an original that the new file does not have.
						original_staging_key: null,
						original_mime_type: source.original_mime_type,
						original_byte_size: source.original_byte_size,
						original_width: source.original_width,
						original_height: source.original_height,
						updated_at: sql<Date>`now()`,
					})
					.where("id", "=", params.id)
					.returning(MEDIA_COLUMN_NAMES)
					.executeTakeFirstOrThrow();
				return {
					media: mapMediaRow(row),
					released: { storageKey: target.storage_key, originalStorageKey: target.original_storage_key },
				};
			});
		},

		discardUnusedMedia: async (id: string): Promise<boolean> => {
			if ((await mediaInUse(db, qSchema, [id])).size > 0) return false;
			const rows = await db
				.updateTable("media_assets")
				.set({ status: "failed", updated_at: sql<Date>`now()` })
				.where("id", "=", id)
				.where("status", "=", "ready")
				.returning("id")
				.execute();
			return rows.length > 0;
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
