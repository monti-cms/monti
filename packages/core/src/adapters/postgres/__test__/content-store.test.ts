import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	contentCollection,
	fillRequiredMetadata,
	recordCollection,
	requiredFields,
	requiredMetadata,
} from "../../../../test/any-site";
import { COLLECTIONS, type Collection } from "../../../core/collections";
import { contentPath } from "../../../core/links";
import { storedFields } from "../../../schema/derive";
import { createContentService } from "../../../services/content-service";
import { ServiceError } from "../../../services/types";
import type { ContentStore, Entry, EntryMetadata } from "../content-store";
import { CmsError, createContentStore, migrateContentStore } from "../content-store";
import { seedEntry, seedSave } from "./seed";
import { closeGlobalPool, createIsolatedTestPool, dropIsolatedTestPool } from "./test-database";

/** 발행 필수값 중 제목이 아닌 첫 필드(블로그는 카테고리). 빠지면 발행을 막는지 본다. */
const missingRequired = requiredFields(contentCollection).find(({ name }) => name !== "title");

/**
 * 아직 공개되지 않은 글도 담을 수 있는 관계 필드(`allowUnpublished`, 블로그는 모음집의 `itemIds`)와 그 컬렉션.
 * 조건부 필드에 딸렸으면 그 조건 값도 함께 넣어야 저장된다.
 */
const unpublishedRelation = (() => {
	for (const collection of COLLECTIONS) {
		for (const stored of storedFields(collection)) {
			const { field } = stored;
			if (field.kind === "relation" && field.allowUnpublished) {
				return { ...stored, collection, to: field.to as Collection, many: Boolean(field.many) };
			}
		}
	}
	return undefined;
})();

describe("ContentStore (M1-DA-1 test-first)", () => {
	let pool: Pool;
	let schemaName: string;
	let store: ReturnType<typeof createContentStore>;
	let relationTarget: (to: Collection) => Promise<string>;
	/** 발행 필수값을 채우지 않고 저장하는 저장소(필수값 검사를 시험할 때). */
	let rawStore: ContentStore;

	/** 원시 스냅샷에 채워지는 메타데이터(제목 + 설정의 발행 필수값). */
	const filled = (title: string, collection: Collection = contentCollection) =>
		requiredMetadata(collection, title, relationTarget);

	beforeAll(async () => {
		const isolated = await createIsolatedTestPool();
		pool = isolated.pool;
		schemaName = isolated.schemaName;

		await migrateContentStore(pool, { schema: schemaName });
		store = createContentStore(pool, { schema: schemaName });
		// 발행 필수값(블로그의 카테고리 같은 것)은 설정에서 찾아 채운다.
		const fill = fillRequiredMetadata(store);
		relationTarget = fill.relationTarget;
		rawStore = { ...store, createEntryWithReferences: fill.raw.createEntryWithReferences };
	});

	afterAll(async () => {
		if (pool && schemaName) {
			await dropIsolatedTestPool(pool, schemaName);
		}
		await closeGlobalPool();
	});

	it("creates a new entry with correct timestamp fields", async () => {
		const entry = await seedEntry(store, {
			collection: contentCollection,
			slug: "test-timestamps",
			metadata: { title: "Timestamps" },
			mdx: "test",
			schemaVersion: 1,
			contentHash: "hash-ts",
		});

		expect(entry.id).toBeDefined();
		expect(typeof entry.version).toBe("number");

		expect(entry.createdAt).toBeInstanceOf(Date);
		expect(entry.updatedAt).toBeInstanceOf(Date);
		expect(entry.working.updatedAt).toBeInstanceOf(Date);

		expect(entry.publishedAt ?? null).toBeNull();
	});

	it("allows two drafts in the same collection with slug null and manages workingSlug/publishedSlug", async () => {
		const draft1 = await seedEntry(store, {
			collection: contentCollection,
			slug: null,
			metadata: { title: "Draft" },
			mdx: "draft 1",
			schemaVersion: 1,
			contentHash: "hash-slug-1",
		});
		const draft2 = await seedEntry(store, {
			collection: contentCollection,
			slug: null,
			metadata: { title: "Draft" },
			mdx: "draft 2",
			schemaVersion: 1,
			contentHash: "hash-slug-2",
		});

		expect(draft1.id).not.toBe(draft2.id);
		expect(draft1.workingSlug ?? null).toBeNull();
		expect(draft1.publishedSlug ?? null).toBeNull();

		const saved1 = await seedSave(store, draft1.id, {
			expectedVersion: draft1.version,
			slug: "draft-1-slug",
			metadata: { title: "Draft" },
			mdx: "draft 1 updated",
			schemaVersion: 1,
			contentHash: "hash-slug-1-updated",
		});

		expect(saved1.workingSlug).toBe("draft-1-slug");
		expect(saved1.publishedSlug ?? null).toBeNull();

		const published = await store.publishEntry({ id: saved1.id, expectedVersion: saved1.version });
		expect(published.publishedSlug).toBe("draft-1-slug");

		const savedAgain = await seedSave(store, published.id, {
			expectedVersion: published.version,
			slug: "draft-1-slug-new",
			metadata: { title: "Draft" },
			mdx: "draft 1 updated again",
			schemaVersion: 1,
			contentHash: "hash-slug-1-updated-again",
		});

		expect(savedAgain.workingSlug).toBe("draft-1-slug-new");
		expect(savedAgain.publishedSlug).toBe("draft-1-slug");
	});

	it("timestamps: publish behavior and immutability", async () => {
		const entry = await seedEntry(store, {
			collection: contentCollection,
			slug: "time-test",
			metadata: { title: "Draft" },
			mdx: "time test",
			schemaVersion: 1,
			contentHash: "hash-time",
		});

		const initialWorkingUpdatedAt = entry.working.updatedAt?.getTime();

		await new Promise((r) => setTimeout(r, 10));

		const published = await store.publishEntry({ id: entry.id, expectedVersion: entry.version });

		expect(published.working.updatedAt?.getTime()).toBe(initialWorkingUpdatedAt);
		expect(published.published?.updatedAt?.getTime()).toBe(initialWorkingUpdatedAt);

		expect(published.publishedAt).toBeInstanceOf(Date);

		const pubAt = published.publishedAt?.getTime();

		await new Promise((r) => setTimeout(r, 10));

		const saved = await seedSave(store, published.id, {
			expectedVersion: published.version,
			metadata: { title: "Draft" },
			mdx: "time test updated",
			schemaVersion: 1,
			contentHash: "hash-time-2",
		});

		expect(saved.publishedAt?.getTime()).toBe(pubAt);
		expect(saved.published?.updatedAt?.getTime()).toBe(initialWorkingUpdatedAt);

		expect(saved.working.updatedAt?.getTime()).toBeGreaterThan(initialWorkingUpdatedAt);
	});

	it("identical save leaves version, hash, and updatedAt unchanged", async () => {
		const entry = await seedEntry(store, {
			collection: contentCollection,
			slug: "identical",
			metadata: { title: "Draft" },
			mdx: "draft content",
			schemaVersion: 1,
			contentHash: "hash-identical",
		});

		const saved = await seedSave(store, entry.id, {
			expectedVersion: entry.version,
			metadata: { title: "Draft" },
			mdx: "draft content",
			schemaVersion: 1,
			contentHash: "hash-identical",
		});

		expect(saved.version).toBe(entry.version);
		expect(saved.working.contentHash).toBe(entry.working.contentHash);
		expect(saved.working.updatedAt?.getTime()).toEqual(entry.working.updatedAt?.getTime());
		expect(saved.updatedAt.getTime()).toEqual(entry.updatedAt.getTime());

		const reloaded = await store.getEntry(entry.id);
		expect(reloaded.version).toBe(entry.version);
		expect(reloaded.updatedAt.getTime()).toEqual(entry.updatedAt.getTime());
		expect(reloaded.working.contentHash).toBe(entry.working.contentHash);
		expect(reloaded.working.metadata).toEqual(entry.working.metadata);
		expect(reloaded.working.mdx).toBe(entry.working.mdx);
		expect(reloaded.working.schemaVersion).toBe(entry.working.schemaVersion);
	});

	it("same-hash correctness: changed metadata/MDX/schemaVersion with reused hash is published", async () => {
		const entry = await seedEntry(store, {
			collection: contentCollection,
			slug: "republish-hash",
			metadata: { title: "Hash Test" },
			mdx: "hash test",
			schemaVersion: 1,
			contentHash: "same-hash",
		});

		const firstPublish = await store.publishEntry({ id: entry.id, expectedVersion: entry.version });

		const secondSave = await seedSave(store, entry.id, {
			expectedVersion: firstPublish.version,
			metadata: { title: "Hash Test Changed" },
			mdx: "hash test changed",
			schemaVersion: 2,
			contentHash: "same-hash",
		});

		const secondPublish = await store.publishEntry({ id: entry.id, expectedVersion: secondSave.version });
		expect(secondPublish.published?.metadata).toEqual(await filled("Hash Test Changed"));
		expect(secondPublish.published?.mdx).toBe("hash test changed");
		expect(secondPublish.published?.schemaVersion).toBe(2);
		expect(secondPublish.published?.contentHash).toBe("same-hash");

		const reloaded = await store.getEntry(entry.id);
		expect(reloaded.published?.metadata).toEqual(await filled("Hash Test Changed"));
		expect(reloaded.published?.mdx).toBe("hash test changed");
		expect(reloaded.published?.schemaVersion).toBe(2);
		expect(reloaded.published?.contentHash).toBe("same-hash");
	});

	it("metadata JSON boundary: invalid value rejected with invalid_input", async () => {
		const entry = await seedEntry(store, {
			collection: contentCollection,
			slug: "json-boundary",
			metadata: { title: "JSON Boundary" },
			mdx: "json",
			schemaVersion: 1,
			contentHash: "hash-json",
		});

		const badMetadata = {
			title: "Bad",
			nested: { invalid: Number.NaN },
		} as unknown as EntryMetadata;

		let caught: unknown;
		try {
			await seedSave(store, entry.id, {
				expectedVersion: entry.version,
				metadata: badMetadata,
				mdx: "json updated",
				schemaVersion: 1,
				contentHash: "hash-json-2",
			});
		} catch (e) {
			caught = e;
		}

		expect(caught).toBeInstanceOf(CmsError);
		expect(caught).toMatchObject({ code: "invalid_input" });

		const reloaded = await store.getEntry(entry.id);
		expect(reloaded.version).toBe(entry.version);
		expect(reloaded.working.metadata).toEqual(await filled("JSON Boundary"));
	});

	it("true simultaneous-writer test: resolves one conflict", async () => {
		const entry = await seedEntry(store, {
			collection: contentCollection,
			slug: "simul-test",
			metadata: { title: "Simultaneous" },
			mdx: "simul",
			schemaVersion: 1,
			contentHash: "hash-simul",
		});

		const p1 = seedSave(store, entry.id, {
			expectedVersion: entry.version,
			metadata: { title: "Win 1" },
			mdx: "win 1",
			schemaVersion: 1,
			contentHash: "hash-simul-1",
		});
		const p2 = seedSave(store, entry.id, {
			expectedVersion: entry.version,
			metadata: { title: "Win 2" },
			mdx: "win 2",
			schemaVersion: 1,
			contentHash: "hash-simul-2",
		});

		const results = await Promise.allSettled([p1, p2]);

		const isFulfilled = (result: PromiseSettledResult<Entry>): result is PromiseFulfilledResult<Entry> =>
			result.status === "fulfilled";
		const isRejected = (result: PromiseSettledResult<Entry>): result is PromiseRejectedResult =>
			result.status === "rejected";

		const fulfilled = results.filter(isFulfilled);
		const rejected = results.filter(isRejected);

		expect(fulfilled.length).toBe(1);
		expect(rejected.length).toBe(1);

		const winner = fulfilled[0].value;
		const error = rejected[0].reason;

		expect(error).toBeInstanceOf(CmsError);
		expect(error).toMatchObject({
			code: "conflict",
			serverVersion: winner.version,
		});

		const reloaded = await store.getEntry(entry.id);
		expect(reloaded.version).toBe(winner.version);
		expect(reloaded.working.contentHash).toBe(winner.working.contentHash);
	});

	it("stale expectedVersion throws CmsError with code conflict and serverVersion", async () => {
		const entry = await seedEntry(store, {
			collection: contentCollection,
			slug: "stale-test",
			metadata: { title: "Initial" },
			mdx: "initial",
			schemaVersion: 1,
			contentHash: "hash-1",
		});

		const updated = await seedSave(store, entry.id, {
			expectedVersion: entry.version,
			metadata: { title: "Update 1" },
			mdx: "update 1",
			schemaVersion: 1,
			contentHash: "hash-2",
		});

		const stalePromise = seedSave(store, entry.id, {
			expectedVersion: entry.version,
			metadata: { title: "Update 2" },
			mdx: "update 2",
			schemaVersion: 1,
			contentHash: "hash-3",
		});

		expect(typeof updated.version).toBe("number");

		let caughtError: unknown;
		try {
			await stalePromise;
		} catch (error) {
			caughtError = error;
		}

		expect(caughtError).toBeInstanceOf(CmsError);
		expect(caughtError).toMatchObject({
			code: "conflict",
			serverVersion: updated.version,
		});
	});

	it("keeps working and published snapshots separate", async () => {
		const entry = await seedEntry(store, {
			collection: contentCollection,
			slug: "separation-test",
			metadata: { title: "Initial Draft" },
			mdx: "initial draft",
			schemaVersion: 1,
			contentHash: "hash-draft",
		});

		const published = await store.publishEntry({ id: entry.id, expectedVersion: entry.version });
		expect(published.publishedAt).toBeDefined();

		await seedSave(store, entry.id, {
			expectedVersion: published.version,
			metadata: { title: "Updated Draft" },
			mdx: "updated draft",
			schemaVersion: 2,
			contentHash: "hash-updated",
		});

		const reloaded = await store.getEntry(entry.id);

		expect(reloaded.working.metadata).toEqual(await filled("Updated Draft"));
		expect(reloaded.working.mdx).toBe("updated draft");
		expect(reloaded.working.contentHash).toBe("hash-updated");
		expect(reloaded.working.schemaVersion).toBe(2);

		expect(reloaded.published).toEqual(published.published);
		expect(reloaded.publishedAt?.getTime()).toEqual(published.publishedAt?.getTime());
	});

	it("republishing the same content hash does not replace the published snapshot", async () => {
		const entry = await seedEntry(store, {
			collection: contentCollection,
			slug: "republish-hash-identical",
			metadata: { title: "Hash Test" },
			mdx: "hash test",
			schemaVersion: 1,
			contentHash: "same-hash-ident",
		});

		const firstPublish = await store.publishEntry({ id: entry.id, expectedVersion: entry.version });

		const secondSave = await seedSave(store, entry.id, {
			expectedVersion: firstPublish.version,
			metadata: { title: "Hash Test" },
			mdx: "hash test",
			schemaVersion: 1,
			contentHash: "same-hash-ident",
		});

		await store.publishEntry({ id: entry.id, expectedVersion: secondSave.version });

		const reloaded = await store.getEntry(entry.id);
		expect(reloaded.published).toEqual(firstPublish.published);
		expect(reloaded.publishedAt?.getTime()).toEqual(firstPublish.publishedAt?.getTime());
	});

	it("a transaction failure during publish leaves the prior published snapshot intact", async () => {
		const entry = await seedEntry(store, {
			collection: contentCollection,
			slug: "rollback-test",
			metadata: { title: "First Publish" },
			mdx: "first publish",
			schemaVersion: 1,
			contentHash: "hash-rollback-1",
		});

		const firstPublish = await store.publishEntry({ id: entry.id, expectedVersion: entry.version });

		const update = await seedSave(store, entry.id, {
			expectedVersion: firstPublish.version,
			metadata: { title: "Second Publish" },
			mdx: "second publish",
			schemaVersion: 1,
			contentHash: "hash-rollback-2",
		});

		const capturedState = await store.getEntry(entry.id);

		let hookReached = false;
		const failingStore = createContentStore(pool, {
			schema: schemaName,
			beforePublishCommit: async () => {
				hookReached = true;
				throw new Error("Simulated publish failure");
			},
		});

		await expect(failingStore.publishEntry({ id: entry.id, expectedVersion: update.version })).rejects.toThrow();

		expect(hookReached).toBe(true);

		const reloaded = await store.getEntry(entry.id);
		expect(reloaded).toEqual(capturedState);
	});

	it("published entry can clear its working slug, cannot publish without one, and keeps its public slug reserved", async () => {
		const entry = await seedEntry(store, {
			collection: contentCollection,
			slug: "clear-slug-test",
			metadata: { title: "Clear" },
			mdx: "test",
			schemaVersion: 1,
			contentHash: "hash-c1",
		});

		const published = await store.publishEntry({ id: entry.id, expectedVersion: entry.version });

		const saved = await seedSave(store, entry.id, {
			expectedVersion: published.version,
			slug: null,
			metadata: {},
			mdx: "test null",
			schemaVersion: 1,
			contentHash: "hash-c2",
		});

		const reloaded = await store.getEntry(entry.id);
		expect(reloaded.workingSlug ?? null).toBeNull();
		expect(reloaded.publishedSlug).toBe("clear-slug-test");

		// slug 없는 초안은 발행할 수 없다(§5.6). 공개 주소는 그대로 유지된다.
		await expect(store.publishEntry({ id: entry.id, expectedVersion: saved.version })).rejects.toMatchObject({
			code: "publish_validation_failed",
			issues: expect.arrayContaining([expect.objectContaining({ code: "null_slug" })]),
		});
		expect((await store.getEntry(entry.id)).publishedSlug).toBe("clear-slug-test");

		await expect(
			seedEntry(store, {
				collection: contentCollection,
				slug: "clear-slug-test",
				metadata: {},
				mdx: "collision",
				schemaVersion: 1,
				contentHash: "hash-c3",
			}),
		).rejects.toThrow();
	});

	it.skipIf(!missingRequired)("rejects invalid direct publication without creating a published snapshot", async () => {
		const draft = await seedEntry(rawStore, {
			collection: contentCollection,
			slug: "validation-missing-required",
			metadata: { title: "Missing required" },
			mdx: "A valid body.",
			schemaVersion: 1,
			contentHash: "validation-missing-required-hash",
		});

		await expect(store.publishEntry({ id: draft.id, expectedVersion: draft.version })).rejects.toMatchObject({
			code: "publish_validation_failed",
			issues: expect.arrayContaining([
				expect.objectContaining({
					code: "missing_field",
					path: missingRequired?.name,
					message: missingRequired?.field.label,
				}),
			]),
		});
		const unchanged = await store.getEntry(draft.id);
		expect(unchanged.status).toBe("draft");
		expect(unchanged.published).toBeUndefined();
	});

	it("atomically publishes record creates and rolls invalid edits back", async () => {
		const service = createContentService(store);
		const badSlug = "validation-invalid-record-create";
		await expect(
			service.createDraft(
				{ collection: recordCollection, slug: badSlug, metadata: { title: "" }, mdx: "" },
				{ publishImmediately: true },
			),
		).rejects.toBeInstanceOf(ServiceError);
		const notCreated = await pool.query(
			`SELECT id FROM "${schemaName}".entries WHERE collection = $1 AND working_slug = $2`,
			[recordCollection, badSlug],
		);
		expect(notCreated.rows).toHaveLength(0);

		const published = await service.createDraft(
			{
				collection: recordCollection,
				slug: "validation-valid-record",
				metadata: await filled("Valid record", recordCollection),
				mdx: "",
			},
			{ publishImmediately: true },
		);
		expect(published.status).toBe("published");
		expect(published.published).toBeDefined();
		const before = await store.getEntry(published.id);

		await expect(
			service.saveDraft(
				published.id,
				{
					collection: recordCollection,
					expectedVersion: before.version,
					slug: null,
					metadata: { title: "" },
					mdx: "",
				},
				{ publishImmediately: true },
			),
		).rejects.toBeInstanceOf(ServiceError);
		const after = await store.getEntry(published.id);
		expect(after.version).toBe(before.version);
		expect(after.status).toBe("published");
		expect(after.workingSlug).toBe(before.workingSlug);
		expect(after.working.metadata).toEqual(before.working.metadata);
	});

	it("validates internal links against locked publication addresses", async () => {
		const target = await seedEntry(store, {
			collection: contentCollection,
			slug: "validation-link-target",
			metadata: { title: "Target" },
			mdx: "Target body.",
			schemaVersion: 1,
			contentHash: "validation-link-target-hash",
		});
		const source = await seedEntry(store, {
			collection: contentCollection,
			slug: "validation-link-source",
			metadata: { title: "Source" },
			// 공개 주소 모양은 설정의 `path`를 따른다(블로그 `/posts/:slug`).
			mdx: `[Target](${contentPath(contentCollection, "validation-link-target")})`,
			schemaVersion: 1,
			contentHash: "validation-link-source-hash",
		});

		await expect(store.publishEntry({ id: source.id, expectedVersion: source.version })).rejects.toMatchObject({
			code: "publish_validation_failed",
			issues: expect.arrayContaining([expect.objectContaining({ code: "unpublished_internal_link" })]),
		});
		const publishedTarget = await store.publishEntry({ id: target.id, expectedVersion: target.version });
		const publishedSource = await store.publishEntry({ id: source.id, expectedVersion: source.version });
		expect(publishedTarget.status).toBe("published");
		expect(publishedSource.status).toBe("published");
	});

	it.skipIf(!unpublishedRelation)(
		"allows draft references only through relations that allow unpublished targets",
		async () => {
			if (!unpublishedRelation) return;
			const { collection, name, to, many, when } = unpublishedRelation;
			const draftItem = await seedEntry(store, {
				collection: to,
				slug: "validation-collection-draft-item",
				metadata: { title: "Draft item" },
				mdx: "Draft body.",
				schemaVersion: 1,
				contentHash: "validation-collection-draft-item-hash",
			});
			expect(draftItem.status).toBe("draft");
			const service = createContentService(store);
			const collectionDraft = await service.createDraft({
				collection,
				slug: "validation-collection",
				metadata: {
					...(await filled("Reading list", collection)),
					...(when ? { [when.field]: when.value } : {}),
					[name]: many ? [draftItem.id] : draftItem.id,
				},
				mdx: "",
			});
			const published = await store.publishEntry({ id: collectionDraft.id, expectedVersion: collectionDraft.version });
			expect(published.status).toBe("published");
		},
	);

	it("metadata accepts valid own JSON keys named constructor and __proto__", async () => {
		const metadata = JSON.parse('{"constructor":"val1","__proto__":"val2"}');

		// 원시 값 그대로 넣는다(발행 필수값을 채우지 않는다).
		const entry = await seedEntry(rawStore, {
			collection: contentCollection,
			slug: "proto-test",
			metadata,
			mdx: "test",
			schemaVersion: 1,
			contentHash: "hash-proto",
		});

		const reloaded = await store.getEntry(entry.id);

		expect(Object.hasOwn(reloaded.working.metadata, "constructor")).toBe(true);
		expect(Object.hasOwn(reloaded.working.metadata, "__proto__")).toBe(true);

		expect(Object.getOwnPropertyDescriptor(reloaded.working.metadata, "constructor")?.value).toBe("val1");
		expect(Object.getOwnPropertyDescriptor(reloaded.working.metadata, "__proto__")?.value).toBe("val2");
	});
});
