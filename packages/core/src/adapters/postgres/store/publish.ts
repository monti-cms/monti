import { sql } from "kysely";
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
import type { Entry } from "../../../core/store/types";
import { type Issue, type PreparedSnapshot, type Reference, ServiceError } from "../../../core/types";
import type { StoreContext } from "./context";
import { type AddressRow, loadEntry, lockEntryForUpdate, readBody, readReferences, writeBody } from "./rows";
import { ROW_COLLECTION, titleExpr } from "./title-sql";

export interface PublishOptions {
	expectedVersion: number;
	/**
	 * The prepared snapshot of the draft being published. The service builds it (hooks, normalization, reference collection) before the
	 * transaction; the store only checks it against rows it has to lock (reference targets, media, link addresses) and never prepares content itself.
	 */
	snapshot: PreparedSnapshot;
	/** On re-publish, reset the publish date to now. Otherwise keep the first publish time. */
	resetPublishedAt?: boolean;
	/** Sets the publish date to this time (a re-publish with no change included). The import of content that was published elsewhere first uses it. */
	publishedAt?: Date;
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

/** The transaction's `client` is what the hook (`beforePublishCommit`) receives; the queries run on the Kysely handle of the same client (`ctx.db(client)`). */
export function createPublishing(ctx: StoreContext) {
	const { hooks, site } = ctx;

	/** Checks the prepared snapshot of the draft inside the transaction. Locks reference targets and internal link slugs. */
	const validatePreparedForPublish = async (client: PoolClient, entryId: string, snapshot: PreparedSnapshot) => {
		const trx = ctx.db(client);
		const entry = await trx
			.selectFrom("entries")
			.select(["collection", "version", "translation_group_id"])
			.where("id", "=", entryId)
			.executeTakeFirst();
		if (!entry) throw new CmsError("Entry not found", "not_found");
		assertSameCollection(entry.collection, snapshot.collection);
		// A translation locks its source and checks its published status, so the source cannot leave the public layer during publish.
		const translation = entry.translation_group_id
			? {
					sourcePublished:
						(
							await trx
								.selectFrom("entries")
								.select("status")
								.where("id", "=", entry.translation_group_id)
								.forShare()
								.executeTakeFirst()
						)?.status === "published",
				}
			: undefined;
		const previousReferences = await readReferences(trx, entryId, "working");

		const publishSnapshot = {
			...snapshot,
			references: mergePublishReferences(snapshot.references, previousReferences),
		};

		const links = snapshot.internalLinks ?? [];
		const findAddresses = async (lock: boolean) => {
			if (links.length === 0) return [] as AddressRow[];
			// A body link names an address in a language: `/posts/slug` the default language, `/en/posts/slug` the one of the locale prefix.
			// It is swapped to the reader's language at render time.
			return trx
				.selectFrom("content_addresses as a")
				.select(["a.collection", "a.locale", "a.slug", "a.type", "a.entry_id"])
				.where(
					sql<boolean>`(a.collection, a.locale, a.slug) in (select * from unnest(${links.map((link) => link.collection)}::text[], ${links.map((link) => link.locale ?? site.DEFAULT_LOCALE)}::text[], ${links.map((link) => link.slug)}::text[]))`,
				)
				.orderBy("a.collection")
				.orderBy("a.locale")
				.orderBy("a.slug")
				.$if(lock, (qb) => qb.forShare())
				.execute();
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
			? await trx
					.selectFrom("entries")
					.select(["id", "collection", "status", "translation_group_id"])
					.where("id", "=", sql<string>`any(${Array.from(targetIds).sort()}::uuid[])`)
					.orderBy("id")
					.forShare()
					.execute()
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
			? await trx
					.selectFrom("media_assets")
					.select(["id", "status", "storage_key"])
					.where("id", "=", sql<string>`any(${mediaIds}::uuid[])`)
					.orderBy("id")
					.forShare()
					.execute()
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
		const trx = ctx.db(client);
		const locked = await lockEntryForUpdate(trx, id, options.expectedVersion);
		assertPublishableStatus(locked.status);

		// Not `onWarnings?.(await ...)`: an absent callback must not skip the checks.
		const checked = await validatePreparedForPublish(client, id, options.snapshot);
		options.onWarnings?.(checked.warnings);

		const working = await readBody(trx, id, "working");
		if (!working) throw new CmsError("Working draft not found", "not_found");
		const published = await readBody(trx, id, "published");
		const currentSlugRow = await trx
			.selectFrom("content_addresses")
			.select("slug")
			.where("entry_id", "=", id)
			.where("type", "=", "current")
			.executeTakeFirst();
		const currentSlug = currentSlugRow?.slug ?? null;
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
			await trx
				.updateTable("entries")
				.set({
					version: locked.version + 1,
					status: "published",
					published_at:
						options.publishedAt ?? (options.resetPublishedAt ? now : sql<Date>`coalesce(published_at, ${now})`),
					changed_by: currentActor(),
					changed_at: now,
				})
				.where("id", "=", id)
				.execute();
			await writeBody(site, trx, id, "published", {
				metadata: working.metadata,
				doc: working.doc,
				schemaVersion: working.schema_version,
				contentHash: working.content_hash,
				updatedAt: working.updated_at,
				translation: working.translation,
			});
			await trx.deleteFrom("content_addresses").where("entry_id", "=", id).where("type", "=", "reservation").execute();
			const address = planPublishAddress(currentSlug, targetSlug);
			if (address.demoteCurrent) {
				await trx
					.updateTable("content_addresses")
					.set({ type: "alias" })
					.where("entry_id", "=", id)
					.where("type", "=", "current")
					.execute();
			}
			if (address.promote) {
				// When returning to a former alias, promote that slug back to current.
				await trx
					.insertInto("content_addresses")
					.values({
						collection: locked.collection,
						locale: locked.locale,
						slug: targetSlug as string,
						entry_id: id,
						type: "current",
					})
					.onConflict((conflict) =>
						conflict
							.columns(["collection", "locale", "slug"])
							.doUpdateSet({ type: "current" })
							.where("content_addresses.entry_id", "=", sql<string>`excluded.entry_id`),
					)
					.execute();
				const check = await trx
					.selectFrom("content_addresses")
					.select(["entry_id", "type"])
					.where("collection", "=", locked.collection)
					.where("locale", "=", locked.locale)
					.where("slug", "=", targetSlug as string)
					.executeTakeFirst();
				assertPromotedToCurrent(id, check ? holderOf(check) : null);
			}
		} else if (options.resetPublishedAt || options.publishedAt) {
			await trx
				.updateTable("entries")
				.set({
					version: locked.version + 1,
					status: "published",
					published_at: options.publishedAt ?? now,
					changed_by: currentActor(),
					changed_at: now,
				})
				.where("id", "=", id)
				.execute();
		} else {
			await trx.updateTable("entries").set({ status: "published" }).where("id", "=", id).execute();
		}

		await trx.deleteFrom("entry_references").where("entry_id", "=", id).where("state", "=", "published").execute();
		await trx
			.insertInto("entry_references")
			.columns([
				"entry_id",
				"state",
				"kind",
				"target_id",
				"target_entry_id",
				"target_media_id",
				"is_stale",
				"occurrences",
			])
			.expression((eb) =>
				eb
					.selectFrom("entry_references")
					.select([
						"entry_id",
						sql<string>`'published'`.as("state"),
						"kind",
						"target_id",
						"target_entry_id",
						"target_media_id",
						"is_stale",
						"occurrences",
					])
					.where("entry_id", "=", id)
					.where("state", "=", "working"),
			)
			.execute();

		const entry = await loadEntry(trx, id);
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
		const rows = ids.length
			? await ctx
					.db(client)
					.selectFrom("entries")
					.select(["id", "status"])
					.where("id", "=", sql<string>`any(${ids}::uuid[])`)
					.orderBy("id")
					.forShare()
					.execute()
			: [];
		// A link in the body to a trashed entry is not refused (the draft can still be saved and the link removed); publishing it is, as an unpublished link.
		const trashed = new Set(rows.filter((row) => row.status === "trashed").map((row) => row.id));
		if (references.some((ref) => trashed.has(ref.targetId) && ref.occurrences.some((o) => o.type !== "body"))) {
			throw new CmsError("Cannot reference a trashed entry", "invalid_reference");
		}
		const found = new Set(rows.map((row) => row.id));
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
		const usage = await ctx
			.db(client)
			.selectFrom("entry_references as r")
			.innerJoin("entries as e", "e.id", "r.entry_id")
			.leftJoin("entry_bodies as b", (join) =>
				join.onRef("b.entry_id", "=", "r.entry_id").onRef("b.state", "=", "r.state"),
			)
			.select([
				"r.entry_id as source_id",
				titleExpr(site, "b.metadata", ROW_COLLECTION).as("title"),
				"e.collection",
				"r.state",
			])
			.distinct()
			.where("r.target_entry_id", "=", id)
			.where("r.entry_id", "<>", id)
			.$if(options.ignoreTrashedSources, (qb) => qb.where("e.status", "<>", "trashed"))
			.orderBy("source_id")
			.execute();
		if (usage.length > 0) {
			throw new CmsError("Other entries still reference this entry", "in_use", undefined, {
				usages: usage.map((row) => ({
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
