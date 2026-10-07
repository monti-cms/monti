import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { sql } from "kysely";
import { currentActor } from "../../../core/actor";
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
import type { Db } from "../db/kysely";
import { type StoreContext, withTrx } from "./context";
import { mapEntryWriteError } from "./errors";
import { recordEvents } from "./events";
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
import { ROW_COLLECTION, titleExpr } from "./title-sql";

/** The group an entry belongs to: its source, or itself for a source. */
const groupOf = (alias: string) =>
	sql<string>`coalesce(${sql.ref(`${alias}.translation_group_id`)}, ${sql.ref(`${alias}.id`)})`;

export function createEntryOps(ctx: StoreContext, publishing: Publishing) {
	const { qSchema, site } = ctx;
	const db = ctx.db();
	const { publishWithinTransaction, lockDraftReferenceTargets } = publishing;

	const assertFolder = async (trx: Db, folderId: string | null | undefined, collection: string) => {
		if (!folderId) return;
		const folder = await trx.selectFrom("folders").select("collection").where("id", "=", folderId).executeTakeFirst();
		assertFolderInCollection(folder?.collection, collection);
	};

	/**
	 * Reserves the draft's slug (the rule is `reservationFor`). Releases a previous reservation that was never published.
	 */
	const reserveSlug = async (trx: Db, entryId: string, collection: string, locale: string, slug: string | null) => {
		await trx
			.deleteFrom("content_addresses")
			.where("entry_id", "=", entryId)
			.where("type", "=", "reservation")
			.execute();
		if (slug === null) return;
		// Slug uniqueness is collection + language + slug. A translation may use the same slug as its source.
		const existing = await trx
			.selectFrom("content_addresses")
			.select("entry_id")
			.where("collection", "=", collection)
			.where("locale", "=", locale)
			.where("slug", "=", slug)
			.executeTakeFirst();
		const holder = existing ? { entryId: existing.entry_id } : null;
		if (reservationFor(entryId, holder) === "keep") return;
		await trx
			.insertInto("content_addresses")
			.values({ collection, locale, slug, entry_id: entryId, type: "reservation" })
			.execute();
	};

	/** Locks the source to translate and checks it (`assertTranslationSource`). */
	const checkTranslationSource = async (trx: Db, sourceId: string, collection: string, locale: string) => {
		const row = await trx
			.selectFrom("entries")
			.select(["collection", "status", "locale", "translation_group_id as group_id"])
			.where("id", "=", sourceId)
			.forShare()
			.executeTakeFirst();
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
			withTrx(
				ctx,
				async (trx, client) => {
					const metadata = normalizeMetadata(params.snapshot.metadata);
					const references = await lockDraftReferenceTargets(client, params.references);
					await assertFolder(trx, params.folderId, params.snapshot.collection);
					const id = randomUUID();
					const now = new Date();
					const locale = params.locale ?? site.DEFAULT_LOCALE;
					assertKnownLocale(site, locale);
					if (params.translationOf) {
						await checkTranslationSource(trx, params.translationOf, params.snapshot.collection, locale);
						assertTranslationMetadata(site, params.snapshot.collection, true, params.snapshot.metadata);
					}

					await trx
						.insertInto("entries")
						.values({
							id,
							collection: params.snapshot.collection,
							version: 1,
							created_at: now,
							updated_at: now,
							working_slug: params.snapshot.slug,
							folder_id: params.folderId ?? null,
							locale,
							translation_group_id: params.translationOf ?? null,
						})
						.execute();
					const translation = params.snapshot.translation ?? null;
					assertTranslationStateAllowed(translation, Boolean(params.translationOf));
					await writeBody(site, trx, id, "working", {
						metadata,
						doc: params.snapshot.doc,
						schemaVersion: params.snapshot.schemaVersion,
						contentHash: params.snapshot.contentHash,
						updatedAt: now,
						translation,
					});
					await reserveSlug(trx, id, params.snapshot.collection, locale, params.snapshot.slug);
					await insertReferences(trx, id, "working", references);

					const entry = params.publishImmediately
						? await publishWithinTransaction(client, id, { expectedVersion: 1, snapshot: params.snapshot })
						: await loadEntry(trx, id);
					// A create that also published is reported as the create, then the publish.
					await recordEvents(client, qSchema, entry, [
						"created",
						...(params.publishImmediately && entry.status === "published" ? (["published"] as const) : []),
					]);
					return entry;
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
			/** Sets the publish date (instead of now or the kept first-publish time), for content that was published before it came here. */
			publishedAt?: Date;
			/** With `publishImmediately`: receives the notices of the publish checks. */
			onWarnings?: (warnings: readonly Issue[]) => void;
		}): Promise<Entry> =>
			withTrx(
				ctx,
				async (trx, client) => {
					const metadata = normalizeMetadata(params.snapshot.metadata);
					const locked = await lockEntryForUpdate(trx, params.entryId);
					assertSameCollection(locked.collection, params.snapshot.collection);
					assertExpectedVersion(locked.version, params.expectedVersion);
					assertEditableStatus(locked.status);
					assertTranslationMetadata(
						site,
						locked.collection,
						locked.translation_group_id !== params.entryId,
						params.snapshot.metadata,
					);

					await assertFolder(trx, params.folderId, params.snapshot.collection);

					const body = await readBody(trx, params.entryId, "working");
					const currentRefs = await readReferences(trx, params.entryId, "working");
					// A reference stored with a body occurrence in the old shape (`{type:"mdx"}`) is rewritten in the new one by this save.
					const legacy = await trx
						.selectFrom("entry_references")
						.select("occurrences")
						.where("entry_id", "=", params.entryId)
						.where("state", "=", "working")
						.execute();
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
						isReferencesEqual(currentRefs, references) && !legacy.some((row) => hasLegacyOccurrence(row.occurrences));

					let version = locked.version;
					if (!bodyIdentical || !refsEqual || folderChanged) {
						version += 1;
						const now = new Date();
						await trx
							.updateTable("entries")
							.set({
								version,
								updated_at: bodyIdentical && refsEqual ? locked.updated_at : now,
								working_slug: nextSlug,
								// The folder only moves when the caller sent one (`null` moves the entry to the top level).
								...(folderChanged ? { folder_id: params.folderId ?? null } : {}),
								changed_by: currentActor(),
								changed_at: now,
							})
							.where("id", "=", params.entryId)
							.execute();
						if (!bodyIdentical) {
							await writeBody(site, trx, params.entryId, "working", {
								metadata,
								doc: params.snapshot.doc,
								schemaVersion: params.snapshot.schemaVersion,
								contentHash: params.snapshot.contentHash,
								updatedAt: now,
								translation,
							});
							if (locked.working_slug !== nextSlug) {
								await reserveSlug(trx, params.entryId, locked.collection, locked.locale, nextSlug);
							}
						}
						if (!refsEqual) {
							await trx
								.deleteFrom("entry_references")
								.where("entry_id", "=", params.entryId)
								.where("state", "=", "working")
								.execute();
							await insertReferences(trx, params.entryId, "working", references);
						}
					}

					// Same content written differently (other block ids, say): keep the new document (and the search text), but it is not a content
					// change, so the content modified date stays.
					if (body && bodyIdentical && !isDeepStrictEqual(body.doc, params.snapshot.doc)) {
						await writeBody(site, trx, params.entryId, "working", {
							metadata,
							doc: params.snapshot.doc,
							schemaVersion: body.schema_version,
							contentHash: body.content_hash,
							updatedAt: body.updated_at,
							translation,
						});
					}

					const entry = params.publishImmediately
						? await publishWithinTransaction(client, params.entryId, {
								expectedVersion: version,
								snapshot: params.snapshot,
								resetPublishedAt: params.resetPublishedAt,
								publishedAt: params.publishedAt,
								onWarnings: params.onWarnings,
							})
						: await loadEntry(trx, params.entryId);
					await recordEvents(client, qSchema, entry, [
						"saved",
						...(params.publishImmediately && entry.status === "published" ? (["published"] as const) : []),
					]);
					return entry;
				},
				{ mapError: mapEntryWriteError },
			),

		getWorkingReferences: async (params: { entryId: string }): Promise<Reference[]> =>
			readReferences(db, params.entryId, "working"),

		getWorking: async (params: { entryId: string }): Promise<WorkingCopy> => {
			const row = await db
				.selectFrom("entries as e")
				.innerJoin("entry_bodies as b", (join) => join.onRef("e.id", "=", "b.entry_id").on("b.state", "=", "working"))
				.select([
					"e.collection",
					"e.version",
					"e.working_slug",
					"e.folder_id",
					"e.locale",
					sql<string>`coalesce(e.translation_group_id, e.id)`.as("translation_group_id"),
					"b.metadata",
					"b.doc",
				])
				.where("e.id", "=", params.entryId)
				.executeTakeFirst();
			if (!row) throw new CmsError("Entry not found", "not_found");
			return {
				collection: row.collection as WorkingCopy["collection"],
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
			const rows = await db
				.selectFrom("entries as e")
				.innerJoin("entries as m", (join) => join.on(groupOf("m"), "=", groupOf("e")))
				.innerJoin("entry_bodies as b", (join) => join.onRef("b.entry_id", "=", "m.id").on("b.state", "=", "working"))
				.select((eb) => [
					"m.id",
					"m.locale",
					"m.status",
					eb("m.translation_group_id", "is", null).$castTo<boolean>().as("is_source"),
					sql<string>`coalesce(m.translation_group_id, m.id)`.as("group_id"),
					titleExpr(site, "b.metadata", { column: "m.collection" }).as("title"),
					"m.working_slug",
				])
				.where("e.id", "=", params.entryId)
				.orderBy((eb) => eb("m.translation_group_id", "is not", null))
				.orderBy("m.locale")
				.execute();
			if (rows.length === 0) throw new CmsError("Entry not found", "not_found");
			return {
				groupId: rows[0]?.group_id ?? params.entryId,
				members: rows.map((row) => ({
					id: row.id,
					locale: row.locale,
					status: row.status,
					isSource: row.is_source,
					title: row.title,
					workingSlug: row.working_slug,
				})),
			};
		},

		getEntry: async (id: string): Promise<Entry> => loadEntry(db, id),

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
			const row = await db
				.selectFrom("entries")
				.select("id")
				.where("collection", "=", params.collection)
				.where("working_slug", "=", params.slug)
				// A translation may share the source's slug, so disambiguate by language.
				.where("locale", "=", params.locale ?? site.DEFAULT_LOCALE)
				.limit(1)
				.executeTakeFirst();
			return row ? loadEntry(db, row.id) : null;
		},

		/** Publishes the saved draft. `snapshot` is the prepared draft (see `PublishOptions.snapshot`). */
		publishEntry: async (params: {
			id: string;
			expectedVersion: number;
			snapshot: PreparedSnapshot;
			resetPublishedAt?: boolean;
			/** Sets the publish date (instead of now or the kept first-publish time), for content that was published before it came here. */
			publishedAt?: Date;
			onWarnings?: (warnings: readonly Issue[]) => void;
		}): Promise<Entry> =>
			withTrx(
				ctx,
				async (_trx, client) => {
					const entry = await publishWithinTransaction(client, params.id, params);
					await recordEvents(client, qSchema, entry, ["published"]);
					return entry;
				},
				{ mapError: mapEntryWriteError },
			),

		slugsInUse: async (params: {
			collection: string;
			locale: string;
			slugs: readonly string[];
			excludeEntryId?: string;
		}): Promise<Set<string>> => {
			if (params.slugs.length === 0) return new Set();
			const { excludeEntryId } = params;
			const rows = await db
				.selectFrom("content_addresses")
				.select("slug")
				.where("collection", "=", params.collection)
				.where("locale", "=", params.locale)
				.where("slug", "=", sql<string>`any(${[...params.slugs]}::text[])`)
				.$if(excludeEntryId !== undefined, (qb) => qb.where("entry_id", "is distinct from", excludeEntryId as string))
				.execute();
			return new Set(rows.map((row) => row.slug));
		},

		resolveLinkTargets: async (params: {
			addresses: readonly { collection: string; slug: string; locale?: string }[];
		}): Promise<{ collection: string; slug: string; locale: string; entryId: string }[]> => {
			if (params.addresses.length === 0) return [];
			// A body link (`/posts/slug`) is the default-language URL. Current, former and reserved addresses all name an entry; a trashed entry is not one a new
			// link can be made to (saving a reference to it is refused), so its address is left as written.
			const rows = await db
				.selectFrom("content_addresses as a")
				.innerJoin("entries as e", "e.id", "a.entry_id")
				.select([
					"a.collection",
					"a.slug",
					"a.locale",
					sql<string>`coalesce(e.translation_group_id, e.id)`.as("entry_id"),
				])
				.where("a.type", "in", ["current", "alias", "reservation"])
				.where("e.status", "<>", "trashed")
				.where(
					sql<boolean>`(a.collection, a.locale, a.slug) in (select * from unnest(${params.addresses.map((a) => a.collection)}::text[], ${params.addresses.map((a) => a.locale ?? site.DEFAULT_LOCALE)}::text[], ${params.addresses.map((a) => a.slug)}::text[]))`,
				)
				.execute();
			return rows.map((row) => ({
				collection: row.collection,
				slug: row.slug,
				locale: row.locale,
				entryId: row.entry_id,
			}));
		},

		/** The detail screen's `사용처`. Returns field relations and body references split into draft and published. */
		getIncomingReferences: async (params: { targetId: string }): Promise<IncomingReferenceItem[]> => {
			const rows = await db
				.selectFrom("entry_references as r")
				.innerJoin("entries as e", "e.id", "r.entry_id")
				.leftJoin("entry_bodies as b", (join) => join.onRef("b.entry_id", "=", "e.id").onRef("b.state", "=", "r.state"))
				.leftJoin("content_addresses as current_address", (join) =>
					join
						.onRef("current_address.entry_id", "=", "e.id")
						.onRef("current_address.collection", "=", "e.collection")
						.on("current_address.type", "=", "current"),
				)
				.select((eb) => [
					"r.state",
					"e.id as source_id",
					"e.collection as source_collection",
					titleExpr(site, "b.metadata", ROW_COLLECTION).as("source_title"),
					eb
						.case()
						.when("r.state", "=", "published")
						.then(eb.ref("current_address.slug"))
						.else(eb.ref("e.working_slug"))
						.end()
						.as("source_slug"),
					"r.kind",
					"r.is_stale",
					"r.occurrences",
				])
				.where("r.target_id", "=", params.targetId)
				.where("r.state", "in", ["working", "published"])
				.where("e.status", "<>", "trashed")
				.where((eb) => eb.or([eb("r.state", "<>", "published"), eb("e.status", "=", "published")]))
				.orderBy((eb) => eb.case().when("r.state", "=", "working").then(0).else(1).end())
				.orderBy("e.updated_at", "desc")
				.orderBy("e.id", "asc")
				.execute();
			return rows.map((row) => ({
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
