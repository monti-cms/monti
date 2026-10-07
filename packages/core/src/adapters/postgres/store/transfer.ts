import { sql } from "kysely";
import { CmsError } from "../../../core/store/errors";
import type { ExportSnapshot, ExportSnapshotBody, ExportSnapshotEntry } from "../../../core/store/types";
import { readReferenceOccurrences } from "../../../core/types";
import { type StoreContext, withTrx } from "./context";
import { MEDIA_COLUMN_NAMES, mapFolderRow, mapMediaRow, mapTemplateRow, readBodyDoc, readTranslation } from "./rows";

/** Admin export. */
export function createTransferOps(ctx: StoreContext) {
	return {
		/** Read-only snapshot for export. Entry order is fixed so the same data yields the same result. */
		readExportSnapshot: async (): Promise<ExportSnapshot> =>
			withTrx(
				ctx,
				async (trx) => {
					const entriesRes = await trx
						.selectFrom("entries as e")
						.select((eb) => [
							"e.id",
							"e.collection",
							"e.locale",
							sql<string>`coalesce(e.translation_group_id, e.id)`.as("translation_group_id"),
							"e.status",
							"e.version",
							"e.folder_id",
							"e.working_slug",
							"e.created_at",
							"e.updated_at",
							"e.published_at",
							eb
								.selectFrom("content_addresses")
								.select("slug")
								.whereRef("entry_id", "=", "e.id")
								.where("type", "=", "current")
								.as("current_slug"),
						])
						.orderBy("e.collection", "asc")
						.orderBy("e.id", "asc")
						.execute();

					const bodiesRes = await trx
						.selectFrom("entry_bodies")
						.select([
							"entry_id",
							"state",
							"metadata",
							"doc",
							"schema_version",
							"content_hash",
							"updated_at",
							"translation",
						])
						.orderBy("entry_id", "asc")
						.orderBy("state", "asc")
						.execute();

					const referencesRes = await trx
						.selectFrom("entry_references")
						.select(["entry_id", "state", "kind", "target_id", "is_stale", "occurrences"])
						.orderBy("entry_id", "asc")
						.orderBy("state", "asc")
						.orderBy("kind", "asc")
						.orderBy("target_id", "asc")
						.execute();

					const foldersRes = await trx
						.selectFrom("folders")
						.select(["id", "collection", "parent_id", "name", "position", "version"])
						.orderBy("collection", "asc")
						.orderBy("id", "asc")
						.execute();

					const addressesRes = await trx
						.selectFrom("content_addresses")
						.select(["collection", "locale", "slug", "entry_id", "type"])
						.orderBy("collection", "asc")
						.orderBy("locale", "asc")
						.orderBy("slug", "asc")
						.execute();

					const mediaRes = await trx
						.selectFrom("media_assets")
						.select(MEDIA_COLUMN_NAMES)
						.orderBy("id", "asc")
						.execute();

					const templatesRes = await trx
						.selectFrom("body_templates")
						.select(["id", "name", "doc", "version", "created_at", "updated_at"])
						.orderBy((eb) => eb.fn("lower", ["name"]), "asc")
						.orderBy("id", "asc")
						.execute();

					const preferencesRes = await trx
						.selectFrom("user_preferences")
						.select(["user_id", "preferences", "updated_at"])
						.orderBy("user_id", "asc")
						.execute();

					const bodiesByEntry = new Map<string, ExportSnapshotBody>();
					const bodiesByEntryPublished = new Map<string, ExportSnapshotBody>();
					for (const row of bodiesRes) {
						const body: ExportSnapshotBody = {
							metadata: row.metadata,
							doc: readBodyDoc(row.doc, null),
							schemaVersion: row.schema_version,
							contentHash: row.content_hash,
							updatedAt: row.updated_at,
							translation: readTranslation(row.translation),
						};
						if (row.state === "working") bodiesByEntry.set(row.entry_id, body);
						else if (row.state === "published") bodiesByEntryPublished.set(row.entry_id, body);
					}

					const entries: ExportSnapshotEntry[] = [];
					for (const row of entriesRes) {
						const working = bodiesByEntry.get(row.id);
						if (!working) {
							throw new CmsError(`Entry ${row.id} is missing working body`, "invalid_state");
						}
						entries.push({
							id: row.id,
							collection: row.collection,
							locale: row.locale,
							translationGroupId: row.translation_group_id,
							status: row.status,
							version: row.version,
							folderId: row.folder_id,
							workingSlug: row.working_slug,
							publishedSlug: row.current_slug,
							createdAt: row.created_at,
							updatedAt: row.updated_at,
							publishedAt: row.published_at,
							working,
							...(bodiesByEntryPublished.has(row.id) ? { published: bodiesByEntryPublished.get(row.id) } : {}),
						});
					}

					return {
						entries,
						references: referencesRes.map((row) => ({
							entryId: row.entry_id,
							state: row.state,
							kind: row.kind,
							targetId: row.target_id,
							isStale: row.is_stale,
							occurrences: readReferenceOccurrences(row.occurrences),
						})),
						folders: foldersRes.map(mapFolderRow),
						addresses: addressesRes.map((row) => ({
							collection: row.collection,
							locale: row.locale,
							slug: row.slug,
							entryId: row.entry_id,
							type: row.type,
						})),
						media: mediaRes.map(mapMediaRow),
						templates: templatesRes.map(mapTemplateRow),
						preferences: preferencesRes.map((row) => ({
							userId: row.user_id,
							preferences: row.preferences,
							updatedAt: row.updated_at,
						})),
					};
				},
				{ begin: "BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY" },
			),
	};
}
