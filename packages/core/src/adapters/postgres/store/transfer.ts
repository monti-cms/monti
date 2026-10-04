import type { TranslationState } from "../../../core/translation/state";
import { type StoreContext, withTransaction } from "./context";
import { CmsError } from "./errors";
import {
	type FolderRow,
	MEDIA_COLUMNS,
	type MediaRow,
	mapFolderRow,
	mapMediaRow,
	mapTemplateRow,
	TEMPLATE_COLUMNS,
	type TemplateRow,
} from "./rows";
import type { EntryMetadata, ExportSnapshot, ExportSnapshotBody, ExportSnapshotEntry, JsonObject } from "./types";

/** 관리자 내보내기(§11.4). */
export function createTransferOps(ctx: StoreContext) {
	const { pool, qSchema } = ctx;
	return {
		/** 내보내기용 읽기 전용 스냅샷. 항목 순서를 고정해 같은 데이터면 같은 결과를 만든다. */
		readExportSnapshot: async (): Promise<ExportSnapshot> =>
			withTransaction(
				pool,
				async (client) => {
					const entriesRes = await client.query<{
						id: string;
						collection: string;
						locale: string;
						translation_group_id: string;
						status: string;
						version: number;
						folder_id: string | null;
						working_slug: string | null;
						current_slug: string | null;
						created_at: Date;
						updated_at: Date;
						published_at: Date | null;
					}>(
						`SELECT e.id, e.collection, e.locale, COALESCE(e.translation_group_id, e.id) AS translation_group_id,
					        e.status, e.version, e.folder_id, e.working_slug, e.created_at, e.updated_at,
					        e.published_at,
					        (SELECT slug FROM "${qSchema}".content_addresses WHERE entry_id = e.id AND type = 'current') AS current_slug
					 FROM "${qSchema}".entries e
					 ORDER BY e.collection ASC, e.id ASC`,
					);

					const bodiesRes = await client.query<{
						entry_id: string;
						state: string;
						metadata: EntryMetadata;
						mdx: string;
						schema_version: number;
						content_hash: string;
						updated_at: Date;
						translation: TranslationState | null;
					}>(
						`SELECT entry_id, state, metadata, mdx, schema_version, content_hash, updated_at, translation
					 FROM "${qSchema}".entry_bodies ORDER BY entry_id ASC, state ASC`,
					);

					const referencesRes = await client.query<{
						entry_id: string;
						state: string;
						kind: string;
						target_id: string;
						is_stale: boolean;
						occurrences: unknown;
					}>(
						`SELECT entry_id, state, kind, target_id, is_stale, occurrences
					 FROM "${qSchema}".entry_references ORDER BY entry_id ASC, state ASC, kind ASC, target_id ASC`,
					);

					const foldersRes = await client.query<FolderRow>(
						`SELECT id, collection, parent_id, name, position, version FROM "${qSchema}".folders ORDER BY collection ASC, id ASC`,
					);

					const addressesRes = await client.query<{
						collection: string;
						locale: string;
						slug: string;
						entry_id: string | null;
						type: string;
					}>(
						`SELECT collection, locale, slug, entry_id, type FROM "${qSchema}".content_addresses
						 ORDER BY collection ASC, locale ASC, slug ASC`,
					);

					const mediaRes = await client.query<MediaRow>(
						`SELECT ${MEDIA_COLUMNS} FROM "${qSchema}".media_assets ORDER BY id ASC`,
					);

					const templatesRes = await client.query<TemplateRow>(
						`SELECT ${TEMPLATE_COLUMNS}
					 FROM "${qSchema}".body_templates ORDER BY lower(name) ASC, id ASC`,
					);

					const preferencesRes = await client.query<{ user_id: string; preferences: JsonObject; updated_at: Date }>(
						`SELECT user_id, preferences, updated_at FROM "${qSchema}".user_preferences ORDER BY user_id ASC`,
					);

					const bodiesByEntry = new Map<string, ExportSnapshotBody>();
					const bodiesByEntryPublished = new Map<string, ExportSnapshotBody>();
					for (const row of bodiesRes.rows) {
						const body: ExportSnapshotBody = {
							metadata: row.metadata,
							mdx: row.mdx,
							schemaVersion: row.schema_version,
							contentHash: row.content_hash,
							updatedAt: row.updated_at,
							translation: row.translation ?? null,
						};
						if (row.state === "working") bodiesByEntry.set(row.entry_id, body);
						else if (row.state === "published") bodiesByEntryPublished.set(row.entry_id, body);
					}

					const entries: ExportSnapshotEntry[] = [];
					for (const row of entriesRes.rows) {
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
						references: referencesRes.rows.map((row) => ({
							entryId: row.entry_id,
							state: row.state,
							kind: row.kind,
							targetId: row.target_id,
							isStale: row.is_stale,
							occurrences: row.occurrences,
						})),
						folders: foldersRes.rows.map(mapFolderRow),
						addresses: addressesRes.rows.map((row) => ({
							collection: row.collection,
							locale: row.locale,
							slug: row.slug,
							entryId: row.entry_id,
							type: row.type,
						})),
						media: mediaRes.rows.map(mapMediaRow),
						templates: templatesRes.rows.map(mapTemplateRow),
						preferences: preferencesRes.rows.map((row) => ({
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
