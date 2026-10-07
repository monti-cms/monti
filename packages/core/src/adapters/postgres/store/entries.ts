import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import type { PoolClient } from "pg";
import { assertFolderInCollection } from "../../../core/domain/folders";
import { normalizeMetadata } from "../../../core/domain/metadata";
import {
	assertEditableStatus,
	assertExpectedVersion,
	assertSameCollection,
	isSameWorkingBody,
} from "../../../core/domain/publish";
import { isReferencesEqual } from "../../../core/domain/references";
import { reservationFor } from "../../../core/domain/slug-address";
import {
	assertKnownLocale,
	assertTranslationMetadata,
	assertTranslationSource,
	assertTranslationStateAllowed,
} from "../../../core/domain/translation";
import { CmsError } from "../../../core/store/errors";
import type { Entry, IncomingReferenceItem, TranslationGroup } from "../../../core/store/types";
import type { Issue } from "../../../core/types";
import {
	hasLegacyOccurrence,
	normalizeReferenceKind,
	type PreparedSnapshot,
	type Reference,
	readReferenceOccurrences,
	type WorkingCopy,
} from "../../../core/types";
import { type StoreContext, withTransaction } from "./context";
import { mapEntryWriteError } from "./errors";
import type { Publishing } from "./publish";
import {
	insertReferences,
	loadEntry,
	lockEntryForUpdate,
	readBody,
	readBodyDoc,
	readReferences,
	writeBody,
} from "./rows";

export function createEntryOps(ctx: StoreContext, publishing: Publishing) {
	const { pool, qSchema, site } = ctx;
	const { publishWithinTransaction, lockDraftReferenceTargets } = publishing;

	const assertFolder = async (client: PoolClient, folderId: string | null | undefined, collection: string) => {
		if (!folderId) return;
		const res = await client.query<{ collection: string }>(
			`SELECT collection FROM "${qSchema}".folders WHERE id = $1`,
			[folderId],
		);
		assertFolderInCollection(res.rows[0]?.collection, collection);
	};

	/**
	 * Reserves the draft's slug (the rule is `reservationFor`). Releases a previous reservation that was never published.
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
		const holder = existing.rows[0] ? { entryId: existing.rows[0].entry_id } : null;
		if (reservationFor(entryId, holder) === "keep") return;
		await client.query(
			`INSERT INTO "${qSchema}".content_addresses (collection, locale, slug, entry_id, type) VALUES ($1, $2, $3, $4, 'reservation')`,
			[collection, locale, slug, entryId],
		);
	};

	/** Locks the source to translate and checks it (`assertTranslationSource`). */
	const checkTranslationSource = async (client: PoolClient, sourceId: string, collection: string, locale: string) => {
		const res = await client.query<{
			collection: string;
			status: Entry["status"];
			locale: string;
			group_id: string | null;
		}>(
			`SELECT collection, status, locale, translation_group_id AS group_id
			 FROM "${qSchema}".entries WHERE id = $1 FOR SHARE`,
			[sourceId],
		);
		const row = res.rows[0];
		assertTranslationSource(
			site,
			row && { collection: row.collection, status: row.status, locale: row.locale, translationGroupId: row.group_id },
			{ collection, locale },
		);
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
					const references = await lockDraftReferenceTargets(client, params.references);
					await assertFolder(client, params.folderId, params.snapshot.collection);
					const id = randomUUID();
					const now = new Date();
					const locale = params.locale ?? site.DEFAULT_LOCALE;
					assertKnownLocale(site, locale);
					if (params.translationOf) {
						await checkTranslationSource(client, params.translationOf, params.snapshot.collection, locale);
						assertTranslationMetadata(site, params.snapshot.collection, true, params.snapshot.metadata);
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
					assertTranslationStateAllowed(translation, Boolean(params.translationOf));
					await writeBody(site, client, qSchema, id, "working", {
						metadata,
						doc: params.snapshot.doc,
						schemaVersion: params.snapshot.schemaVersion,
						contentHash: params.snapshot.contentHash,
						updatedAt: now,
						translation,
					});
					await reserveSlug(client, id, params.snapshot.collection, locale, params.snapshot.slug);
					await insertReferences(client, qSchema, id, "working", references);

					return params.publishImmediately
						? publishWithinTransaction(client, id, { expectedVersion: 1, snapshot: params.snapshot })
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
			/** With `publishImmediately`: reset the publish date to now. */
			resetPublishedAt?: boolean;
			/** With `publishImmediately`: receives the notices of the publish checks. */
			onWarnings?: (warnings: readonly Issue[]) => void;
		}): Promise<Entry> =>
			withTransaction(
				pool,
				async (client) => {
					const metadata = normalizeMetadata(params.snapshot.metadata);
					const locked = await lockEntryForUpdate(client, qSchema, params.entryId);
					assertSameCollection(locked.collection, params.snapshot.collection);
					assertExpectedVersion(locked.version, params.expectedVersion);
					assertEditableStatus(locked.status);
					assertTranslationMetadata(
						site,
						locked.collection,
						locked.translation_group_id !== params.entryId,
						params.snapshot.metadata,
					);

					await assertFolder(client, params.folderId, params.snapshot.collection);

					const body = await readBody(client, qSchema, params.entryId, "working");
					const currentRefs = await readReferences(client, qSchema, params.entryId, "working");
					// A reference stored with a body occurrence in the old shape (`{type:"mdx"}`) is rewritten in the new one by this save.
					const legacy = await client.query<{ occurrences: unknown }>(
						`SELECT occurrences FROM "${qSchema}".entry_references WHERE entry_id = $1 AND state = 'working'`,
						[params.entryId],
					);
					const nextSlug = params.snapshot.slug;
					// If no translation status is sent (bulk operations, etc.), keep the stored value.
					const translation =
						params.snapshot.translation === undefined ? (body?.translation ?? null) : params.snapshot.translation;
					assertTranslationStateAllowed(translation, locked.translation_group_id !== params.entryId);
					const bodyIdentical = isSameWorkingBody(
						body
							? {
									contentHash: body.content_hash,
									slug: locked.working_slug,
									metadata: body.metadata,
									translation: body.translation,
								}
							: null,
						{
							contentHash: params.snapshot.contentHash,
							slug: nextSlug,
							metadata,
							translation,
						},
					);
					const folderChanged = params.folderId !== undefined;

					const references = await lockDraftReferenceTargets(client, params.references);
					const refsEqual =
						isReferencesEqual(currentRefs, references) &&
						!legacy.rows.some((row) => hasLegacyOccurrence(row.occurrences));

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
							await writeBody(site, client, qSchema, params.entryId, "working", {
								metadata,
								doc: params.snapshot.doc,
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
							await insertReferences(client, qSchema, params.entryId, "working", references);
						}
					}

					// Same content written differently (other block ids, say): keep the new document (and the search text), but it is not a content
					// change, so the content modified date stays.
					if (body && bodyIdentical && !isDeepStrictEqual(body.doc, params.snapshot.doc)) {
						await writeBody(site, client, qSchema, params.entryId, "working", {
							metadata,
							doc: params.snapshot.doc,
							schemaVersion: body.schema_version,
							contentHash: body.content_hash,
							updatedAt: body.updated_at,
							translation,
						});
					}

					return params.publishImmediately
						? publishWithinTransaction(client, params.entryId, {
								expectedVersion: version,
								snapshot: params.snapshot,
								resetPublishedAt: params.resetPublishedAt,
								onWarnings: params.onWarnings,
							})
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
				doc: unknown;
			}>(
				`SELECT e.collection, e.version, e.working_slug, e.folder_id, e.locale,
				        COALESCE(e.translation_group_id, e.id) AS translation_group_id, b.metadata, b.doc
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
				doc: readBodyDoc(row.doc, null),
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
				[params.collection, params.slug, params.locale ?? site.DEFAULT_LOCALE],
			);
			return res.rows[0] ? loadEntry(pool, res.rows[0].id, qSchema) : null;
		},

		/** Publishes the saved draft. `snapshot` is the prepared draft (see `PublishOptions.snapshot`). */
		publishEntry: async (params: {
			id: string;
			expectedVersion: number;
			snapshot: PreparedSnapshot;
			resetPublishedAt?: boolean;
			onWarnings?: (warnings: readonly Issue[]) => void;
		}): Promise<Entry> =>
			withTransaction(pool, (client) => publishWithinTransaction(client, params.id, params), {
				mapError: mapEntryWriteError,
			}),

		slugsInUse: async (params: {
			collection: string;
			locale: string;
			slugs: readonly string[];
			excludeEntryId?: string;
		}): Promise<Set<string>> => {
			if (params.slugs.length === 0) return new Set();
			const res = await pool.query<{ slug: string }>(
				`SELECT slug FROM "${qSchema}".content_addresses
				 WHERE collection = $1 AND locale = $2 AND slug = ANY($3::text[])
				   AND ($4::uuid IS NULL OR entry_id IS DISTINCT FROM $4::uuid)`,
				[params.collection, params.locale, [...params.slugs], params.excludeEntryId ?? null],
			);
			return new Set(res.rows.map((row) => row.slug));
		},

		resolveLinkTargets: async (params: {
			addresses: readonly { collection: string; slug: string; locale?: string }[];
		}): Promise<{ collection: string; slug: string; locale: string; entryId: string }[]> => {
			if (params.addresses.length === 0) return [];
			// A body link (`/posts/slug`) is the default-language URL. Current, former and reserved addresses all name an entry; a trashed entry is not one a new
			// link can be made to (saving a reference to it is refused), so its address is left as written.
			const res = await pool.query<{ collection: string; slug: string; locale: string; entry_id: string }>(
				`SELECT a.collection, a.slug, a.locale, COALESCE(e.translation_group_id, e.id) AS entry_id
				 FROM "${qSchema}".content_addresses a
				 JOIN "${qSchema}".entries e ON e.id = a.entry_id
				 WHERE a.type IN ('current', 'alias', 'reservation') AND e.status <> 'trashed'
				   AND (a.collection, a.locale, a.slug) IN (SELECT * FROM unnest($1::text[], $2::text[], $3::text[]))`,
				[
					params.addresses.map((a) => a.collection),
					params.addresses.map((a) => a.locale ?? site.DEFAULT_LOCALE),
					params.addresses.map((a) => a.slug),
				],
			);
			return res.rows.map((row) => ({
				collection: row.collection,
				slug: row.slug,
				locale: row.locale,
				entryId: row.entry_id,
			}));
		},

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
				occurrences: unknown;
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
				occurrences: readReferenceOccurrences(row.occurrences),
			}));
		},
	};
}
