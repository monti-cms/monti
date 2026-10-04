import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import type { PoolClient } from "pg";
import { isCollection, isItemCollection } from "../../../core/collections";
import { DEFAULT_LOCALE, isLocale } from "../../../core/locales";
import { computeContentHash } from "../../../core/snapshot";
import {
	normalizeReferenceKind,
	type PreparedSnapshot,
	type Reference,
	ServiceError,
	type WorkingCopy,
} from "../../../core/types";
import { commonFieldKeys, fieldValueError, storedField } from "../../../schema/derive";
import { type StoreContext, withTransaction } from "./context";
import { CmsError, mapEntryWriteError } from "./errors";
import type { Publishing } from "./publish";
import {
	insertReferences,
	isReferencesEqual,
	loadEntry,
	lockEntryForUpdate,
	normalizeMetadata,
	readBody,
	readReferences,
	writeBody,
} from "./rows";
import type { Entry, IncomingReferenceItem, TranslationGroup } from "./types";

/** Validates the title field value (`title` by library convention). A mismatch throws an error carrying the field path. */
function assertTitleValue(collection: string, title: string): void {
	const stored = isCollection(collection) ? storedField(collection, "title") : undefined;
	const error = stored ? fieldValueError(stored.field, title) : null;
	if (error) throw new ServiceError(error, [{ code: error, path: "title", message: stored?.field.label }]);
}

export function createEntryOps(ctx: StoreContext, publishing: Publishing) {
	const { pool, qSchema } = ctx;
	const { publishWithinTransaction, lockDraftReferenceTargets } = publishing;

	const assertFolder = async (client: PoolClient, folderId: string | null | undefined, collection: string) => {
		if (!folderId) return;
		const res = await client.query<{ collection: string }>(
			`SELECT collection FROM "${qSchema}".folders WHERE id = $1`,
			[folderId],
		);
		if (res.rows[0]?.collection !== collection) throw new CmsError("Invalid folder", "invalid_input");
	};

	/**
	 * Reserves the draft's slug. Releases a previous reservation that was never published, and does not
	 * reserve anew when returning to the entry's own current or alias slug (promoted to current on publish). 409 if another entry owns the slug.
	 */
	const reserveSlug = async (
		client: PoolClient,
		entryId: string,
		collection: string,
		locale: string,
		slug: string | null,
	) => {
		await client.query(`DELETE FROM "${qSchema}".content_addresses WHERE entry_id = $1 AND type = 'reservation'`, [
			entryId,
		]);
		if (slug === null) return;
		// Slug uniqueness is collection + language + slug. A translation may use the same slug as its source.
		const existing = await client.query<{ entry_id: string | null }>(
			`SELECT entry_id FROM "${qSchema}".content_addresses WHERE collection = $1 AND locale = $2 AND slug = $3`,
			[collection, locale, slug],
		);
		if (existing.rows.length > 0) {
			if (existing.rows[0]?.entry_id === entryId) return;
			throw new CmsError("Slug conflict", "slug_conflict");
		}
		await client.query(
			`INSERT INTO "${qSchema}".content_addresses (collection, locale, slug, entry_id, type) VALUES ($1, $2, $3, $4, 'reservation')`,
			[collection, locale, slug, entryId],
		);
	};

	/**
	 * Checks and locks the source to translate. It must be the source of its translation group (no translation of a translation),
	 * belong to a collection that has a body, and not be in the trash. A unique index blocks a second translation in the same language.
	 */
	const assertTranslationSource = async (client: PoolClient, sourceId: string, collection: string, locale: string) => {
		const res = await client.query<{ collection: string; status: string; locale: string; group_id: string | null }>(
			`SELECT collection, status, locale, translation_group_id AS group_id
			 FROM "${qSchema}".entries WHERE id = $1 FOR SHARE`,
			[sourceId],
		);
		const source = res.rows[0];
		if (!source) throw new CmsError("Source entry not found", "not_found");
		if (source.collection !== collection || isItemCollection(collection)) {
			throw new CmsError("Only content collections have translations", "invalid_input");
		}
		if (source.group_id !== null) throw new CmsError("Translate the source entry, not a translation", "invalid_input");
		if (source.status === "trashed") throw new CmsError("A trashed entry cannot be translated", "invalid_status");
		if (source.locale === locale) {
			throw new CmsError("A translation for this locale already exists", "translation_exists");
		}
	};

	/** A translation stores only per-language values. Shared fields belong to the source. */
	const assertTranslationMetadata = (collection: string, isTranslation: boolean, metadata: Record<string, unknown>) => {
		if (!isTranslation || !isCollection(collection)) return;
		const common = commonFieldKeys(collection, metadata);
		if (common.length > 0) {
			throw new CmsError(`Common fields belong to the source: ${common.join(", ")}`, "invalid_input");
		}
	};

	return {
		createEntryWithReferences: async (params: {
			snapshot: PreparedSnapshot;
			references: readonly Reference[];
			folderId?: string | null;
			publishImmediately?: boolean;
			/** Content language. Defaults to the default language. */
			locale?: string;
			/** Source ID for a translation (the translation group ID). */
			translationOf?: string;
		}): Promise<Entry> =>
			withTransaction(
				pool,
				async (client) => {
					const metadata = normalizeMetadata(params.snapshot.metadata);
					await lockDraftReferenceTargets(client, params.references);
					await assertFolder(client, params.folderId, params.snapshot.collection);
					const id = randomUUID();
					const now = new Date();
					const locale = params.locale ?? DEFAULT_LOCALE;
					if (!isLocale(locale)) throw new CmsError("Unknown locale", "invalid_input");
					if (params.translationOf) {
						await assertTranslationSource(client, params.translationOf, params.snapshot.collection, locale);
						assertTranslationMetadata(params.snapshot.collection, true, params.snapshot.metadata);
					}

					await client.query(
						`INSERT INTO "${qSchema}".entries (id, collection, version, created_at, updated_at, working_slug, folder_id, locale, translation_group_id)
						 VALUES ($1, $2, 1, $3, $3, $4, $5, $6, $7)`,
						[
							id,
							params.snapshot.collection,
							now,
							params.snapshot.slug,
							params.folderId ?? null,
							locale,
							params.translationOf ?? null,
						],
					);
					const translation = params.snapshot.translation ?? null;
					// Only translations carry a translation status.
					if (translation !== null && !params.translationOf) {
						throw new CmsError("Only translations have a translation state", "invalid_input");
					}
					await writeBody(client, qSchema, id, "working", {
						metadata,
						mdx: params.snapshot.mdx,
						schemaVersion: params.snapshot.schemaVersion,
						contentHash: params.snapshot.contentHash,
						updatedAt: now,
						translation,
					});
					await reserveSlug(client, id, params.snapshot.collection, locale, params.snapshot.slug);
					await insertReferences(client, qSchema, id, "working", params.references);

					return params.publishImmediately
						? publishWithinTransaction(client, id, { expectedVersion: 1 })
						: loadEntry(client, id, qSchema);
				},
				{ mapError: mapEntryWriteError },
			),

		/**
		 * Saves the latest draft. An identical value leaves the version and modified date unchanged.
		 * Moving only the folder bumps the version but keeps the content modified date.
		 * A scheduled entry may only be moved between folders.
		 */
		saveWorkingWithReferences: async (params: {
			entryId: string;
			expectedVersion: number;
			snapshot: PreparedSnapshot;
			references: readonly Reference[];
			folderId?: string | null;
			publishImmediately?: boolean;
		}): Promise<Entry> =>
			withTransaction(
				pool,
				async (client) => {
					const metadata = normalizeMetadata(params.snapshot.metadata);
					const locked = await lockEntryForUpdate(client, qSchema, params.entryId);
					if (locked.collection !== params.snapshot.collection) {
						throw new CmsError("Collection mismatch", "invalid_input");
					}
					if (locked.version !== params.expectedVersion) {
						throw new CmsError("Conflict", "conflict", locked.version);
					}
					if (locked.status === "trashed") {
						throw new CmsError("A trashed entry must be restored before editing", "invalid_status");
					}
					assertTranslationMetadata(
						locked.collection,
						locked.translation_group_id !== params.entryId,
						params.snapshot.metadata,
					);

					await assertFolder(client, params.folderId, params.snapshot.collection);

					const body = await readBody(client, qSchema, params.entryId, "working");
					const currentRefs = await readReferences(client, qSchema, params.entryId, "working");
					const refsEqual = isReferencesEqual(currentRefs, params.references);
					const nextSlug = params.snapshot.slug;
					// If no translation status is sent (bulk operations, etc.), keep the stored value.
					const translation =
						params.snapshot.translation === undefined ? (body?.translation ?? null) : params.snapshot.translation;
					if (translation !== null && locked.translation_group_id === params.entryId) {
						throw new CmsError("Only translations have a translation state", "invalid_input");
					}
					const bodyIdentical = Boolean(
						body &&
							body.content_hash === params.snapshot.contentHash &&
							body.mdx === params.snapshot.mdx &&
							body.schema_version === params.snapshot.schemaVersion &&
							locked.working_slug === nextSlug &&
							isDeepStrictEqual(body.metadata, metadata) &&
							isDeepStrictEqual(body.translation ?? null, translation),
					);
					const folderChanged = params.folderId !== undefined;

					await lockDraftReferenceTargets(client, params.references);

					let version = locked.version;
					if (!bodyIdentical || !refsEqual || folderChanged) {
						version += 1;
						const now = new Date();
						await client.query(
							`UPDATE "${qSchema}".entries SET version = $1, updated_at = $2, working_slug = $3,
							 folder_id = CASE WHEN $4::boolean THEN $5::uuid ELSE folder_id END
							 WHERE id = $6`,
							[
								version,
								bodyIdentical && refsEqual ? locked.updated_at : now,
								nextSlug,
								folderChanged,
								params.folderId ?? null,
								params.entryId,
							],
						);
						if (!bodyIdentical) {
							await writeBody(client, qSchema, params.entryId, "working", {
								metadata,
								mdx: params.snapshot.mdx,
								schemaVersion: params.snapshot.schemaVersion,
								contentHash: params.snapshot.contentHash,
								updatedAt: now,
								translation,
							});
							if (locked.working_slug !== nextSlug) {
								await reserveSlug(client, params.entryId, locked.collection, locked.locale, nextSlug);
							}
						}
						if (!refsEqual) {
							await client.query(
								`DELETE FROM "${qSchema}".entry_references WHERE entry_id = $1 AND state = 'working'`,
								[params.entryId],
							);
							await insertReferences(client, qSchema, params.entryId, "working", params.references);
						}
					}

					return params.publishImmediately
						? publishWithinTransaction(client, params.entryId, { expectedVersion: version })
						: loadEntry(client, params.entryId, qSchema);
				},
				{ mapError: mapEntryWriteError },
			),

		getWorkingReferences: async (params: { entryId: string }): Promise<Reference[]> =>
			readReferences(pool, qSchema, params.entryId, "working"),

		getWorking: async (params: { entryId: string }): Promise<WorkingCopy> => {
			const res = await pool.query<{
				collection: WorkingCopy["collection"];
				version: number;
				working_slug: string | null;
				folder_id: string | null;
				locale: string;
				translation_group_id: string;
				metadata: Record<string, unknown>;
				mdx: string;
			}>(
				`SELECT e.collection, e.version, e.working_slug, e.folder_id, e.locale,
				        COALESCE(e.translation_group_id, e.id) AS translation_group_id, b.metadata, b.mdx
				 FROM "${qSchema}".entries e
				 JOIN "${qSchema}".entry_bodies b ON e.id = b.entry_id AND b.state = 'working'
				 WHERE e.id = $1`,
				[params.entryId],
			);
			const row = res.rows[0];
			if (!row) throw new CmsError("Entry not found", "not_found");
			return {
				collection: row.collection,
				slug: row.working_slug,
				metadata: row.metadata,
				mdx: row.mdx,
				version: row.version,
				folderId: row.folder_id,
				locale: row.locale,
				translationGroupId: row.translation_group_id,
			};
		},

		/**
		 * Translation group. Returns the source and translations in language order. Used by the editor's language switch and `번역본 만들기`.
		 */
		getTranslationGroup: async (params: { entryId: string }): Promise<TranslationGroup> => {
			const res = await pool.query<{
				id: string;
				locale: string;
				status: Entry["status"];
				is_source: boolean;
				group_id: string;
				title: string | null;
				working_slug: string | null;
			}>(
				`SELECT m.id, m.locale, m.status, (m.translation_group_id IS NULL) AS is_source,
				        COALESCE(m.translation_group_id, m.id) AS group_id,
				        b.metadata->>'title' AS title, m.working_slug
				 FROM "${qSchema}".entries e
				 JOIN "${qSchema}".entries m
				   ON COALESCE(m.translation_group_id, m.id) = COALESCE(e.translation_group_id, e.id)
				 JOIN "${qSchema}".entry_bodies b ON b.entry_id = m.id AND b.state = 'working'
				 WHERE e.id = $1
				 ORDER BY m.translation_group_id IS NOT NULL, m.locale`,
				[params.entryId],
			);
			if (res.rows.length === 0) throw new CmsError("Entry not found", "not_found");
			return {
				groupId: res.rows[0]?.group_id ?? params.entryId,
				members: res.rows.map((row) => ({
					id: row.id,
					locale: row.locale,
					status: row.status,
					isSource: row.is_source,
					title: row.title,
					workingSlug: row.working_slug,
				})),
			};
		},

		getEntry: async (id: string): Promise<Entry> => loadEntry(pool, id, qSchema),

		/**
		 * Admin preview lookup only. Finds an entry and its working body by working slug.
		 * Unlike public reads it also finds drafts, archived, and trashed entries, so the caller must pass admin authentication first.
		 */
		getWorkingEntryBySlug: async (params: {
			collection: string;
			slug: string;
			locale?: string;
		}): Promise<Entry | null> => {
			if (typeof params?.collection !== "string" || typeof params?.slug !== "string") {
				throw new CmsError("Invalid parameters", "invalid_input");
			}
			if (params.slug.trim().length === 0) throw new CmsError("Invalid slug", "invalid_input");
			const res = await pool.query<{ id: string }>(
				// A translation may share the source's slug, so disambiguate by language.
				`SELECT id FROM "${qSchema}".entries WHERE collection = $1 AND working_slug = $2 AND locale = $3 LIMIT 1`,
				[params.collection, params.slug, params.locale ?? DEFAULT_LOCALE],
			);
			return res.rows[0] ? loadEntry(pool, res.rows[0].id, qSchema) : null;
		},

		publishEntry: async (params: { id: string; expectedVersion: number; resetPublishedAt?: boolean }): Promise<Entry> =>
			withTransaction(pool, (client) => publishWithinTransaction(client, params.id, params), {
				mapError: mapEntryWriteError,
			}),

		/**
		 * Duplicate: copies the latest draft's body, fields, and relations into a new draft with a new ID.
		 * Slug, publish status, reservation, published version, publish date, and created/modified times are not copied.
		 * If `title` is given, it replaces the copy's title (`title` field). Any suffix (such as "(copy)") is up to the caller.
		 * The store saves the given value as is and only checks the title field's rules (length, etc.).
		 */
		duplicateEntry: async (params: { id: string; title?: string }): Promise<Entry> =>
			withTransaction(pool, async (client) => {
				const res = await client.query<{
					collection: string;
					folder_id: string | null;
					metadata: Record<string, unknown>;
					mdx: string;
					schema_version: number;
				}>(
					`SELECT e.collection, e.folder_id, b.metadata, b.mdx, b.schema_version
					 FROM "${qSchema}".entries e
					 JOIN "${qSchema}".entry_bodies b ON e.id = b.entry_id AND b.state = 'working'
					 WHERE e.id = $1`,
					[params.id],
				);
				const orig = res.rows[0];
				if (!orig) throw new CmsError("Entry not found", "not_found");
				if (isItemCollection(orig.collection)) {
					throw new CmsError("Record collections cannot be duplicated", "invalid_input");
				}

				const rest = orig.metadata ?? {};
				if (params.title !== undefined) assertTitleValue(orig.collection, params.title);
				const metadata = normalizeMetadata(params.title === undefined ? rest : { ...rest, title: params.title });
				const newId = randomUUID();
				const now = new Date();

				await client.query(
					`INSERT INTO "${qSchema}".entries (id, collection, version, created_at, updated_at, working_slug, folder_id, status)
					 VALUES ($1, $2, 1, $3, $3, NULL, $4, 'draft')`,
					[newId, orig.collection, now, orig.folder_id],
				);
				await writeBody(client, qSchema, newId, "working", {
					metadata,
					mdx: orig.mdx,
					schemaVersion: orig.schema_version,
					contentHash: computeContentHash(metadata, orig.mdx, orig.schema_version),
					updatedAt: now,
					// The copy is an independent source.
					translation: null,
				});
				await client.query(
					`INSERT INTO "${qSchema}".entry_references (entry_id, state, kind, target_id, target_entry_id, target_media_id, is_stale, occurrences)
					 SELECT $1, 'working', kind, target_id, target_entry_id, target_media_id, is_stale, occurrences
					 FROM "${qSchema}".entry_references
					 WHERE entry_id = $2 AND state = 'working'`,
					[newId, params.id],
				);
				return loadEntry(client, newId, qSchema);
			}),

		/** The detail screen's `사용처`. Returns field relations and body references split into draft and published. */
		getIncomingReferences: async (params: { targetId: string }): Promise<IncomingReferenceItem[]> => {
			const res = await pool.query<{
				state: "working" | "published";
				source_id: string;
				source_collection: string;
				source_title: string | null;
				source_slug: string | null;
				kind: string;
				is_stale: boolean;
				occurrences: IncomingReferenceItem["occurrences"];
			}>(
				`SELECT
					r.state,
					e.id as source_id,
					e.collection as source_collection,
					(b.metadata->>'title') as source_title,
					CASE WHEN r.state = 'published' THEN current_address.slug ELSE e.working_slug END as source_slug,
					r.kind,
					r.is_stale,
					r.occurrences
				FROM "${qSchema}".entry_references r
				JOIN "${qSchema}".entries e ON e.id = r.entry_id
				LEFT JOIN "${qSchema}".entry_bodies b ON b.entry_id = e.id AND b.state = r.state
				LEFT JOIN "${qSchema}".content_addresses current_address
					ON current_address.entry_id = e.id AND current_address.collection = e.collection AND current_address.type = 'current'
				WHERE r.target_id = $1 AND r.state IN ('working', 'published')
					AND e.status <> 'trashed'
					AND (r.state <> 'published' OR e.status = 'published')
				ORDER BY CASE WHEN r.state = 'working' THEN 0 ELSE 1 END, e.updated_at DESC, e.id ASC`,
				[params.targetId],
			);
			return res.rows.map((row) => ({
				state: row.state,
				sourceId: row.source_id,
				sourceCollection: row.source_collection,
				sourceTitle: row.source_title,
				sourceSlug: row.source_slug,
				kind: normalizeReferenceKind(row.kind),
				isStale: row.is_stale,
				occurrences: row.occurrences,
			}));
		},
	};
}
