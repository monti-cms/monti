import { isDeepStrictEqual } from "node:util";
import type { PoolClient } from "pg";
import { isUuid } from "../../../core/ids";
import { DEFAULT_LOCALE } from "../../../core/locales";
import { prepareSnapshot, validateForPublish } from "../../../core/snapshot";
import { type Collection, type Reference, ServiceError } from "../../../core/types";
import type { StoreContext } from "./context";
import { CmsError } from "./errors";
import { type AddressRow, loadEntry, lockEntryForUpdate, readBody, readReferences, writeBody } from "./rows";
import type { Entry, EntryStatus } from "./types";

export interface PublishOptions {
	expectedVersion: number;
	/** 다시 발행할 때 발행일을 지금으로 바꾼다. 없으면 처음 발행한 시각을 둔다. */
	resetPublishedAt?: boolean;
}

/**
 * 발행 트랜잭션의 공통 규칙. 발행·레코드 복원이 같은 검증을 쓴다.
 */
export function createPublishing(ctx: StoreContext) {
	const { qSchema, hooks } = ctx;

	/** 저장된 최신 초안을 트랜잭션 안에서 다시 검증한다. 참조 대상·내부 링크 주소를 잠근다. */
	const validateStoredWorkingForPublish = async (client: PoolClient, entryId: string) => {
		const entryRes = await client.query<{
			collection: Collection;
			working_slug: string | null;
			version: number;
			translation_group_id: string | null;
		}>(`SELECT collection, working_slug, version, translation_group_id FROM "${qSchema}".entries WHERE id = $1`, [
			entryId,
		]);
		const entry = entryRes.rows[0];
		if (!entry) throw new CmsError("Entry not found", "not_found");
		// 번역본은 원문을 잠그고 공개 상태를 본다(v2 B4). 발행 중에 원문이 공개에서 빠지지 않게 한다.
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
		const body = await readBody(client, qSchema, entryId, "working");
		if (!body) throw new CmsError("Working draft not found", "not_found");
		const previousReferences = await readReferences(client, qSchema, entryId, "working");

		const snapshot = await prepareSnapshot(
			{ collection: entry.collection, slug: entry.working_slug, metadata: body.metadata as never, mdx: body.mdx },
			{ previousReferences },
		);
		// stale로 남은 과거 참조도 발행 전에 대상이 살아 있는지 확인한다.
		const merged = new Map<string, Reference>(snapshot.references.map((ref) => [`${ref.kind}:${ref.targetId}`, ref]));
		for (const ref of previousReferences) {
			const key = `${ref.kind}:${ref.targetId}`;
			const current = merged.get(key);
			if (!current) merged.set(key, ref);
			else {
				const occurrences = new Map(
					[...current.occurrences, ...ref.occurrences].map((occurrence) => [JSON.stringify(occurrence), occurrence]),
				);
				merged.set(key, { ...current, occurrences: [...occurrences.values()] });
			}
		}
		const publishSnapshot = { ...snapshot, references: [...merged.values()] };

		const links = snapshot.internalLinks ?? [];
		const findAddresses = async (lock: boolean) => {
			if (links.length === 0) return [] as AddressRow[];
			const result = await client.query<AddressRow>(
				// 본문 링크(`/posts/slug`)는 기본 언어 주소다. 다른 언어 번역본으로는 렌더할 때 바꾼다(v2 B4).
				`SELECT a.collection, a.slug, a.type, a.entry_id
				 FROM "${qSchema}".content_addresses a
				 WHERE a.locale = $3 AND (a.collection, a.slug) IN (SELECT * FROM unnest($1::text[], $2::text[]))
				 ORDER BY a.collection, a.slug${lock ? " FOR SHARE" : ""}`,
				[links.map((link) => link.collection), links.map((link) => link.slug), DEFAULT_LOCALE],
			);
			return result.rows;
		};
		const addressKey = (collection: string, slug: string) => `${collection}:${slug}`;
		const firstAddresses = new Map((await findAddresses(false)).map((a) => [addressKey(a.collection, a.slug), a]));

		const targetIds = new Set<string>();
		for (const ref of publishSnapshot.references)
			if (ref.kind !== "media" && isUuid(ref.targetId)) targetIds.add(ref.targetId);
		for (const address of firstAddresses.values()) if (address.entry_id) targetIds.add(address.entry_id);

		const targetRows = targetIds.size
			? (
					await client.query<{ id: string; collection: string; status: EntryStatus }>(
						`SELECT id, collection, status FROM "${qSchema}".entries WHERE id = ANY($1::uuid[]) ORDER BY id FOR SHARE`,
						[Array.from(targetIds).sort()],
					)
				).rows
			: [];
		const targetMap = new Map(targetRows.map((target) => [target.id, target]));
		const lockedAddresses = new Map((await findAddresses(true)).map((a) => [addressKey(a.collection, a.slug), a]));
		for (const link of links) {
			const before = firstAddresses.get(addressKey(link.collection, link.slug));
			const after = lockedAddresses.get(addressKey(link.collection, link.slug));
			if (
				(before?.type ?? null) !== (after?.type ?? null) ||
				(before?.entry_id ?? null) !== (after?.entry_id ?? null)
			) {
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

		const validation = validateForPublish(publishSnapshot, {
			targets: targetRows.map((target) => ({
				id: target.id,
				collection: target.collection,
				isPublished: target.status === "published",
			})),
			media: mediaRows.map((media) => ({ id: media.id, status: media.status, storageKey: media.storage_key })),
			internalLinks: links.map((link) => {
				const address = lockedAddresses.get(addressKey(link.collection, link.slug));
				const target = address?.entry_id ? targetMap.get(address.entry_id) : undefined;
				return {
					collection: link.collection,
					slug: link.slug,
					addressType: address?.type ?? "missing",
					isPublished: target?.collection === link.collection && target.status === "published",
				};
			}),
			...(translation ? { translation } : {}),
		});
		if (!validation.ready) throw new ServiceError("publish_validation_failed", validation.issues);
		return snapshot;
	};

	/**
	 * 최신 초안을 현재 공개본으로 원자적으로 반영한다(§5.2, §9.2).
	 * 발행일(`published_at`)은 처음 발행한 시각이다. 이미 값이 있으면(다시 발행, 이관한 글) 바꾸지 않는다.
	 * `resetPublishedAt`이면 지금으로 바꾼다(바뀐 것이 없는 다시 발행이어도).
	 */
	const publishWithinTransaction = async (client: PoolClient, id: string, options: PublishOptions): Promise<Entry> => {
		const locked = await lockEntryForUpdate(client, qSchema, id, options.expectedVersion);
		if (locked.status === "trashed") throw new CmsError("A trashed entry cannot be published", "invalid_status");
		if (locked.status === "archived") {
			throw new CmsError("An archived entry must be unarchived before publishing", "invalid_status");
		}

		await validateStoredWorkingForPublish(client, id);

		const working = await readBody(client, qSchema, id, "working");
		if (!working) throw new CmsError("Working draft not found", "not_found");
		const published = await readBody(client, qSchema, id, "published");
		const currentSlugRes = await client.query<{ slug: string }>(
			`SELECT slug FROM "${qSchema}".content_addresses WHERE entry_id = $1 AND type = 'current'`,
			[id],
		);
		const currentSlug = currentSlugRes.rows[0]?.slug ?? null;
		const targetSlug = locked.working_slug;

		const isRepublish = Boolean(
			published &&
				published.content_hash === working.content_hash &&
				published.mdx === working.mdx &&
				published.schema_version === working.schema_version &&
				published.updated_at.getTime() === working.updated_at.getTime() &&
				currentSlug === targetSlug &&
				isDeepStrictEqual(published.metadata, working.metadata) &&
				isDeepStrictEqual(published.translation, working.translation),
		);

		const now = new Date();
		if (!isRepublish) {
			await client.query(
				`UPDATE "${qSchema}".entries SET version = $1, status = 'published',
				 published_at = CASE WHEN $4 THEN $2 ELSE COALESCE(published_at, $2) END WHERE id = $3`,
				[locked.version + 1, now, id, Boolean(options.resetPublishedAt)],
			);
			await writeBody(client, qSchema, id, "published", {
				metadata: working.metadata,
				mdx: working.mdx,
				schemaVersion: working.schema_version,
				contentHash: working.content_hash,
				updatedAt: working.updated_at,
				translation: working.translation,
			});
			await client.query(`DELETE FROM "${qSchema}".content_addresses WHERE entry_id = $1 AND type = 'reservation'`, [
				id,
			]);
			if (currentSlug !== null && currentSlug !== targetSlug) {
				await client.query(
					`UPDATE "${qSchema}".content_addresses SET type = 'alias' WHERE entry_id = $1 AND type = 'current'`,
					[id],
				);
			}
			if (targetSlug !== null && targetSlug !== currentSlug) {
				// 과거 별칭으로 되돌아오는 경우 그 주소를 다시 current로 올린다.
				await client.query(
					`INSERT INTO "${qSchema}".content_addresses (collection, locale, slug, entry_id, type) VALUES ($1, $2, $3, $4, 'current')
					 ON CONFLICT (collection, locale, slug) DO UPDATE SET type = 'current'
					 WHERE "${qSchema}".content_addresses.entry_id = EXCLUDED.entry_id`,
					[locked.collection, locked.locale, targetSlug, id],
				);
				const check = await client.query<{ entry_id: string | null; type: string }>(
					`SELECT entry_id, type FROM "${qSchema}".content_addresses WHERE collection = $1 AND locale = $2 AND slug = $3`,
					[locked.collection, locked.locale, targetSlug],
				);
				if (check.rows[0]?.entry_id !== id || check.rows[0]?.type !== "current") {
					throw new CmsError("Slug conflict", "slug_conflict");
				}
			}
		} else if (options.resetPublishedAt) {
			await client.query(
				`UPDATE "${qSchema}".entries SET version = $1, status = 'published', published_at = $2 WHERE id = $3`,
				[locked.version + 1, now, id],
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

	/** 초안이 가리키는 대상을 잠근다. 휴지통 대상은 새로 참조할 수 없다(§6.1). */
	const lockDraftReferenceTargets = async (client: PoolClient, references: readonly Reference[]) => {
		const ids = Array.from(
			new Set(references.filter((ref) => ref.kind !== "media" && isUuid(ref.targetId)).map((ref) => ref.targetId)),
		).sort();
		if (ids.length === 0) return;
		const result = await client.query<{ id: string; status: string }>(
			`SELECT id, status FROM "${qSchema}".entries WHERE id = ANY($1::uuid[]) ORDER BY id FOR SHARE`,
			[ids],
		);
		if (result.rows.some((row) => row.status === "trashed")) {
			throw new CmsError("Cannot reference a trashed entry", "invalid_reference");
		}
	};

	/**
	 * 다른 콘텐츠가 이 항목을 참조하면(초안·공개본 모두) 거부한다.
	 * `trashed` 원본의 참조는 영구 삭제에서만 무시할 수 있으므로 호출자가 고른다.
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

	return { validateStoredWorkingForPublish, publishWithinTransaction, lockDraftReferenceTargets, assertNotReferenced };
}

export type Publishing = ReturnType<typeof createPublishing>;
