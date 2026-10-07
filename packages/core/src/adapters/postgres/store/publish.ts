import type { PoolClient } from "pg";
import { currentActor } from "../../../core/actor";
import {
	assertPublishableStatus,
	assertSameCollection,
	isRepublish,
	mergePublishReferences,
} from "../../../core/domain/publish";
import { assertPromotedToCurrent, linkTargetChanged, planPublishAddress } from "../../../core/domain/slug-address";
import { isUuid } from "../../../core/ids";
import { validateForPublish } from "../../../core/snapshot";
import { CmsError } from "../../../core/store/errors";
import type { Entry, EntryStatus } from "../../../core/store/types";
import { type Collection, type Issue, type PreparedSnapshot, type Reference, ServiceError } from "../../../core/types";
import type { StoreContext } from "./context";
import { type AddressRow, loadEntry, lockEntryForUpdate, readBody, readReferences, writeBody } from "./rows";

export interface PublishOptions {
	expectedVersion: number;
	/**
	 * The prepared snapshot of the draft being published. The service builds it (hooks, normalization, reference collection) before the
	 * transaction; the store only checks it against rows it has to lock (reference targets, media, link addresses) and never prepares content itself.
	 */
	snapshot: PreparedSnapshot;
	/** On re-publish, reset the publish date to now. Otherwise keep the first publish time. */
	resetPublishedAt?: boolean;
	/**
	 * Called with the notices the checks against locked rows found (a link to an entry that is not published): they never block, and the caller
	 * returns them with the publish result.
	 */
	onWarnings?: (warnings: readonly Issue[]) => void;
}

/**
 * Shared rules for publish transactions. Publishing and record restore use the same validation.
 */
const holderOf = (row: Pick<AddressRow, "entry_id" | "type">) => ({ entryId: row.entry_id, type: row.type });

export function createPublishing(ctx: StoreContext) {
	const { qSchema, hooks, site } = ctx;

	/** Checks the prepared snapshot of the draft inside the transaction. Locks reference targets and internal link slugs. */
	const validatePreparedForPublish = async (client: PoolClient, entryId: string, snapshot: PreparedSnapshot) => {
		const entryRes = await client.query<{
			collection: Collection;
			version: number;
			translation_group_id: string | null;
		}>(`SELECT collection, version, translation_group_id FROM "${qSchema}".entries WHERE id = $1`, [entryId]);
		const entry = entryRes.rows[0];
		if (!entry) throw new CmsError("Entry not found", "not_found");
		assertSameCollection(entry.collection, snapshot.collection);
		// A translation locks its source and checks its published status, so the source cannot leave the public layer during publish.
		const translation = entry.translation_group_id
			? {
					sourcePublished:
						(
							await client.query<{ status: string }>(
								`SELECT status FROM "${qSchema}".entries WHERE id = $1 FOR SHARE`,
								[entry.translation_group_id],
							)
						).rows[0]?.status === "published",
				}
			: undefined;
		const previousReferences = await readReferences(client, qSchema, entryId, "working");

		const publishSnapshot = {
			...snapshot,
			references: mergePublishReferences(snapshot.references, previousReferences),
		};

		const links = snapshot.internalLinks ?? [];
		const findAddresses = async (lock: boolean) => {
			if (links.length === 0) return [] as AddressRow[];
			const result = await client.query<AddressRow>(
				// A body link names an address in a language: `/posts/slug` the default language, `/en/posts/slug` the one of the locale prefix.
				// It is swapped to the reader's language at render time.
				`SELECT a.collection, a.locale, a.slug, a.type, a.entry_id
				 FROM "${qSchema}".content_addresses a
				 WHERE (a.collection, a.locale, a.slug) IN (SELECT * FROM unnest($1::text[], $2::text[], $3::text[]))
				 ORDER BY a.collection, a.locale, a.slug${lock ? " FOR SHARE" : ""}`,
				[
					links.map((link) => link.collection),
					links.map((link) => link.locale ?? site.DEFAULT_LOCALE),
					links.map((link) => link.slug),
				],
			);
			return result.rows;
		};
		const addressKey = (collection: string, locale: string | undefined, slug: string) =>
			`${collection}:${locale ?? site.DEFAULT_LOCALE}:${slug}`;
		const firstAddresses = new Map(
			(await findAddresses(false)).map((a) => [addressKey(a.collection, a.locale, a.slug), a]),
		);

		const targetIds = new Set<string>();
		for (const ref of publishSnapshot.references)
			if (ref.kind !== "media" && isUuid(ref.targetId)) targetIds.add(ref.targetId);
		for (const address of firstAddresses.values()) if (address.entry_id) targetIds.add(address.entry_id);

		const targetRows = targetIds.size
			? (
					await client.query<{
						id: string;
						collection: string;
						status: EntryStatus;
						translation_group_id: string | null;
					}>(
						`SELECT id, collection, status, translation_group_id FROM "${qSchema}".entries WHERE id = ANY($1::uuid[]) ORDER BY id FOR SHARE`,
						[Array.from(targetIds).sort()],
					)
				).rows
			: [];
		const targetMap = new Map(targetRows.map((target) => [target.id, target]));
		const lockedAddresses = new Map(
			(await findAddresses(true)).map((a) => [addressKey(a.collection, a.locale, a.slug), a]),
		);
		for (const link of links) {
			const before = firstAddresses.get(addressKey(link.collection, link.locale, link.slug));
			const after = lockedAddresses.get(addressKey(link.collection, link.locale, link.slug));
			if (linkTargetChanged(before && holderOf(before), after && holderOf(after))) {
				throw new CmsError("Internal link target changed during publish", "conflict", entry.version);
			}
		}

		const mediaIds = Array.from(
			new Set(publishSnapshot.references.filter((ref) => ref.kind === "media").map((ref) => ref.targetId)),
		);
		const mediaRows = mediaIds.length
			? (
					await client.query<{ id: string; status: string; storage_key: string | null }>(
						`SELECT id, status, storage_key FROM "${qSchema}".media_assets WHERE id = ANY($1::uuid[]) ORDER BY id FOR SHARE`,
						[mediaIds],
					)
				).rows
			: [];

		const validation = validateForPublish(site, publishSnapshot, {
			targets: targetRows.map((target) => ({
				id: target.id,
				collection: target.collection,
				isPublished: target.status === "published",
				isSource: target.translation_group_id === null || target.translation_group_id === target.id,
			})),
			media: mediaRows.map((media) => ({ id: media.id, status: media.status, storageKey: media.storage_key })),
			internalLinks: links.map((link) => {
				const address = lockedAddresses.get(addressKey(link.collection, link.locale, link.slug));
				const target = address?.entry_id ? targetMap.get(address.entry_id) : undefined;
				return {
					collection: link.collection,
					slug: link.slug,
					...(link.locale ? { locale: link.locale } : {}),
					addressType: address?.type ?? "missing",
					isPublished: target?.collection === link.collection && target.status === "published",
				};
			}),
			...(translation ? { translation } : {}),
		});
		if (!validation.ready) throw new ServiceError("publish_validation_failed", validation.issues);
		return { snapshot, warnings: validation.warnings.filter((issue) => issue.code === "unpublished_internal_link") };
	};

	/**
	 * Atomically applies the latest draft as the current published version.
	 * The publish date (`published_at`) is the time of first publish. It is left unchanged when already set (re-publish, migrated entries).
	 * With `resetPublishedAt` it is set to now (even for a re-publish with no changes).
	 */
	const publishWithinTransaction = async (client: PoolClient, id: string, options: PublishOptions): Promise<Entry> => {
		const locked = await lockEntryForUpdate(client, qSchema, id, options.expectedVersion);
		assertPublishableStatus(locked.status);

		// Not `onWarnings?.(await ...)`: an absent callback must not skip the checks.
		const checked = await validatePreparedForPublish(client, id, options.snapshot);
		options.onWarnings?.(checked.warnings);

		const working = await readBody(client, qSchema, id, "working");
		if (!working) throw new CmsError("Working draft not found", "not_found");
		const published = await readBody(client, qSchema, id, "published");
		const currentSlugRes = await client.query<{ slug: string }>(
			`SELECT slug FROM "${qSchema}".content_addresses WHERE entry_id = $1 AND type = 'current'`,
			[id],
		);
		const currentSlug = currentSlugRes.rows[0]?.slug ?? null;
		const targetSlug = locked.working_slug;

		const bodyState = (body: NonNullable<typeof working>) => ({
			contentHash: body.content_hash,
			updatedAt: body.updated_at,
			metadata: body.metadata,
			translation: body.translation,
		});
		const republish = isRepublish(published ? bodyState(published) : null, bodyState(working), {
			current: currentSlug,
			target: targetSlug,
		});

		const now = new Date();
		if (!republish) {
			await client.query(
				`UPDATE "${qSchema}".entries SET version = $1, status = 'published',
				 published_at = CASE WHEN $4 THEN $2 ELSE COALESCE(published_at, $2) END,
				 changed_by = $5, changed_at = $2 WHERE id = $3`,
				[locked.version + 1, now, id, Boolean(options.resetPublishedAt), currentActor()],
			);
			await writeBody(site, client, qSchema, id, "published", {
				metadata: working.metadata,
				doc: working.doc,
				schemaVersion: working.schema_version,
				contentHash: working.content_hash,
				updatedAt: working.updated_at,
				translation: working.translation,
			});
			await client.query(`DELETE FROM "${qSchema}".content_addresses WHERE entry_id = $1 AND type = 'reservation'`, [
				id,
			]);
			const address = planPublishAddress(currentSlug, targetSlug);
			if (address.demoteCurrent) {
				await client.query(
					`UPDATE "${qSchema}".content_addresses SET type = 'alias' WHERE entry_id = $1 AND type = 'current'`,
					[id],
				);
			}
			if (address.promote) {
				// When returning to a former alias, promote that slug back to current.
				await client.query(
					`INSERT INTO "${qSchema}".content_addresses (collection, locale, slug, entry_id, type) VALUES ($1, $2, $3, $4, 'current')
					 ON CONFLICT (collection, locale, slug) DO UPDATE SET type = 'current'
					 WHERE "${qSchema}".content_addresses.entry_id = EXCLUDED.entry_id`,
					[locked.collection, locked.locale, targetSlug, id],
				);
				const check = await client.query<{ entry_id: string | null; type: AddressRow["type"] }>(
					`SELECT entry_id, type FROM "${qSchema}".content_addresses WHERE collection = $1 AND locale = $2 AND slug = $3`,
					[locked.collection, locked.locale, targetSlug],
				);
				assertPromotedToCurrent(id, check.rows[0] ? holderOf(check.rows[0]) : null);
			}
		} else if (options.resetPublishedAt) {
			await client.query(
				`UPDATE "${qSchema}".entries SET version = $1, status = 'published', published_at = $2,
				 changed_by = $4, changed_at = $2 WHERE id = $3`,
				[locked.version + 1, now, id, currentActor()],
			);
		} else {
			await client.query(`UPDATE "${qSchema}".entries SET status = 'published' WHERE id = $1`, [id]);
		}

		await client.query(`DELETE FROM "${qSchema}".entry_references WHERE entry_id = $1 AND state = 'published'`, [id]);
		await client.query(
			`INSERT INTO "${qSchema}".entry_references
			 (entry_id, state, kind, target_id, target_entry_id, target_media_id, is_stale, occurrences)
			 SELECT entry_id, 'published', kind, target_id, target_entry_id, target_media_id, is_stale, occurrences
			 FROM "${qSchema}".entry_references WHERE entry_id = $1 AND state = 'working'`,
			[id],
		);

		const entry = await loadEntry(client, id, qSchema);
		if (hooks.beforePublishCommit) await hooks.beforePublishCommit(entry, client);
		return entry;
	};

	/**
	 * Locks the targets the draft points at. A trashed target cannot be newly referenced. Returns the references a draft stores: one whose target does
	 * not exist and is only a link in a body (a link to an entry that is gone) is not stored, because the index cannot point at nothing; the publish check still sees it
	 * (it works from the prepared snapshot). A relation to a missing entry is still refused by the foreign key and blocks publishing it.
	 */
	const lockDraftReferenceTargets = async (
		client: PoolClient,
		references: readonly Reference[],
	): Promise<readonly Reference[]> => {
		const ids = Array.from(
			new Set(references.filter((ref) => ref.kind !== "media" && isUuid(ref.targetId)).map((ref) => ref.targetId)),
		).sort();
		const result = ids.length
			? await client.query<{ id: string; status: string }>(
					`SELECT id, status FROM "${qSchema}".entries WHERE id = ANY($1::uuid[]) ORDER BY id FOR SHARE`,
					[ids],
				)
			: { rows: [] as { id: string; status: string }[] };
		// A link in the body to a trashed entry is not refused (the draft can still be saved and the link removed); publishing it is, as an unpublished link.
		const trashed = new Set(result.rows.filter((row) => row.status === "trashed").map((row) => row.id));
		if (references.some((ref) => trashed.has(ref.targetId) && ref.occurrences.some((o) => o.type !== "body"))) {
			throw new CmsError("Cannot reference a trashed entry", "invalid_reference");
		}
		const found = new Set(result.rows.map((row) => row.id));
		const onlyLinks = (ref: Reference) => ref.occurrences.length > 0 && ref.occurrences.every((o) => o.type === "body");
		return references.filter((ref) => ref.kind === "media" || !onlyLinks(ref) || found.has(ref.targetId.toLowerCase()));
	};

	/**
	 * Rejects if other content references this entry (both draft and published).
	 * References from a `trashed` source can be ignored only on permanent delete, so the caller chooses.
	 */
	const assertNotReferenced = async (
		client: PoolClient,
		id: string,
		options: { ignoreTrashedSources: boolean },
	): Promise<void> => {
		const usage = await client.query<{ source_id: string; title: string | null; collection: string; state: string }>(
			`SELECT DISTINCT r.entry_id AS source_id, b.metadata->>'title' AS title, e.collection, r.state
			 FROM "${qSchema}".entry_references r
			 JOIN "${qSchema}".entries e ON e.id = r.entry_id
			 LEFT JOIN "${qSchema}".entry_bodies b ON b.entry_id = r.entry_id AND b.state = r.state
			 WHERE r.target_entry_id = $1 AND r.entry_id <> $1
			 ${options.ignoreTrashedSources ? "AND e.status <> 'trashed'" : ""}
			 ORDER BY source_id`,
			[id],
		);
		if (usage.rows.length > 0) {
			throw new CmsError("Other entries still reference this entry", "in_use", undefined, {
				usages: usage.rows.map((row) => ({
					entryId: row.source_id,
					title: row.title,
					collection: row.collection,
					state: row.state,
				})),
			});
		}
	};

	return { validatePreparedForPublish, publishWithinTransaction, lockDraftReferenceTargets, assertNotReferenced };
}

export type Publishing = ReturnType<typeof createPublishing>;
