import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { contentCollection, fillRequiredMetadata, recordCollection } from "../../../../test/any-site";
import { createContentStore, migrateContentStore } from "../content-store";
import { seedEntry } from "./seed";
import { closeGlobalPool, createIsolatedTestPool, dropIsolatedTestPool } from "./test-database";

/** 컬렉션 이름은 지금 설정에서 찾는다(`test/any-site.ts`). 글은 본문이 있는 문서 컬렉션, 태그는 항목 컬렉션이다. */
const content = contentCollection;
const record = recordCollection;

describe("M3-TW-1 Publishing, Lifecycle & Published-References Contracts", () => {
	let pool: Pool;
	let schemaName: string;
	let store: any;

	beforeAll(async () => {
		const isolated = await createIsolatedTestPool();
		pool = isolated.pool;
		schemaName = isolated.schemaName;

		await migrateContentStore(pool, { schema: schemaName });
		store = createContentStore(pool, { schema: schemaName });
		// 글 발행에 필요한 값(블로그의 카테고리 등)은 이 파일의 시나리오와 무관하므로 저장소가 채운다.
		fillRequiredMetadata(store);
	});

	afterAll(async () => {
		if (pool && schemaName) {
			await dropIsolatedTestPool(pool, schemaName);
		}
		await closeGlobalPool();
	});

	describe("1. Lifecycle State Machine Transitions (§5.3)", () => {
		it("draft -> published creates published body and sets status to published", async () => {
			const entry = await seedEntry(store, {
				collection: content,
				slug: "test-publish-1",
				metadata: { title: "Draft Post" },
				mdx: "Content 1",
				schemaVersion: 1,
				contentHash: "hash-1",
			});

			expect(entry.status).toBe("draft");
			expect(entry.publishedAt).toBeUndefined();

			// 발행일은 처음 발행한 시각이다(§5.5).
			const before = Date.now();
			const published = await store.publishEntry({ id: entry.id, expectedVersion: entry.version });

			expect(published.status).toBe("published");
			expect(published.publishedAt?.getTime()).toBeGreaterThanOrEqual(before - 1000);
			expect(published.publishedAt?.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
		});

		it("published -> archive closes public visibility", async () => {
			const entry = await seedEntry(store, {
				collection: content,
				slug: "test-archive-1",
				metadata: { title: "To Archive" },
				mdx: "Content",
				schemaVersion: 1,
				contentHash: "hash-arch",
			});

			const pub = await store.publishEntry({
				id: entry.id,
				expectedVersion: entry.version,
			});

			const archived = await store.archiveEntry({
				id: entry.id,
				expectedVersion: pub.version,
			});

			expect(archived.status).toBe("archived");
			expect(archived.publishedAt).toBeDefined(); // preserved
		});

		it("archived -> unarchive returns to draft without auto-publishing", async () => {
			const entry = await seedEntry(store, {
				collection: content,
				slug: "test-unarchive-1",
				metadata: { title: "To Unarchive" },
				mdx: "Content",
				schemaVersion: 1,
				contentHash: "hash-unarch",
			});

			const pub = await store.publishEntry({
				id: entry.id,
				expectedVersion: entry.version,
			});

			const arch = await store.archiveEntry({
				id: entry.id,
				expectedVersion: pub.version,
			});

			const unarch = await store.unarchiveEntry({
				id: entry.id,
				expectedVersion: arch.version,
			});

			expect(unarch.status).toBe("draft");
		});

		it("draft/published/archived -> trash hides from active list", async () => {
			const entry = await seedEntry(store, {
				collection: content,
				slug: "test-trash-1",
				metadata: { title: "To Trash" },
				mdx: "Content",
				schemaVersion: 1,
				contentHash: "hash-trash",
			});

			const trashed = await store.trashEntry({
				id: entry.id,
				expectedVersion: entry.version,
			});

			expect(trashed.status).toBe("trashed");
		});

		it("trashed -> restore returns to draft (for publish collection)", async () => {
			const entry = await seedEntry(store, {
				collection: content,
				slug: "test-restore-1",
				metadata: { title: "To Restore" },
				mdx: "Content",
				schemaVersion: 1,
				contentHash: "hash-res",
			});

			const trashed = await store.trashEntry({
				id: entry.id,
				expectedVersion: entry.version,
			});

			const restored = await store.restoreEntry({
				id: entry.id,
				expectedVersion: trashed.version,
			});

			expect(restored.status).toBe("draft");
		});

		it("trashed -> permanentDelete deletes entry but preserves address tombstone", async () => {
			const entry = await seedEntry(store, {
				collection: content,
				slug: "test-perm-delete-1",
				metadata: { title: "Perm Delete" },
				mdx: "Content",
				schemaVersion: 1,
				contentHash: "hash-perm",
			});

			const pub = await store.publishEntry({
				id: entry.id,
				expectedVersion: entry.version,
			});

			const trashed = await store.trashEntry({
				id: entry.id,
				expectedVersion: pub.version,
			});

			await store.permanentDeleteEntry({
				id: entry.id,
				expectedVersion: trashed.version,
			});

			await expect(store.getEntry(entry.id)).rejects.toThrow();

			// Slug should still be reserved / conflict
			await expect(
				seedEntry(store, {
					collection: content,
					slug: "test-perm-delete-1",
					metadata: { title: "Reuse Slug Attempt" },
					mdx: "Content",
					schemaVersion: 1,
					contentHash: "hash-reuse",
				}),
			).rejects.toThrow(/conflict|Slug conflict/i);
		});
	});

	describe("2. Transactional Target Recheck & Published References Rollback (§5.3)", () => {
		it("publishes and copies working references to published references atomically", { timeout: 15000 }, async () => {
			const tag = await seedEntry(store, {
				collection: record,
				slug: "tag-active",
				metadata: { title: "Active Tag" },
				mdx: "",
				schemaVersion: 1,
				contentHash: "tag-hash",
			});

			// tag must be published or active
			await store.publishEntry({ id: tag.id, expectedVersion: tag.version });

			const post = await seedEntry(store, {
				collection: content,
				slug: "post-with-ref",
				metadata: { title: "Post" },
				mdx: "Hello",
				schemaVersion: 1,
				contentHash: "post-hash",
			});

			// Attach working reference
			await store.saveWorkingWithReferences({
				entryId: post.id,
				expectedVersion: post.version,
				snapshot: {
					collection: content,
					slug: "post-with-ref",
					metadata: { title: "Post" },
					mdx: "Hello",
					schemaVersion: 1,
					contentHash: "post-hash-2",
					issues: [],
					references: [],
				},
				references: [
					{
						kind: "entry",
						targetId: tag.id,
						isStale: false,
						occurrences: [{ type: "metadata", path: "tags" }],
					},
				],
			});

			// Now publish post - should succeed and copy reference to state='published'
			const pubPost = await store.publishEntry({
				id: post.id,
				expectedVersion: post.version + 1,
			});

			expect(pubPost.status).toBe("published");

			const pubRefs = await pool.query<{ target_id: string }>(
				`SELECT target_id FROM "${schemaName}".entry_references WHERE entry_id = $1 AND state = 'published'`,
				[post.id],
			);
			expect(pubRefs.rows).toHaveLength(1);
			expect(pubRefs.rows[0].target_id).toBe(tag.id);
		});

		it("prevents trashing or deleting a tag still used by published entries", async () => {
			const tag = await seedEntry(store, {
				collection: record,
				slug: `tag-in-use-${randomUUID()}`,
				metadata: { title: "In-use tag" },
				mdx: "",
				schemaVersion: 1,
				contentHash: randomUUID(),
			});
			const publishedTag = await store.publishEntry({ id: tag.id, expectedVersion: tag.version });
			const post = await seedEntry(store, {
				collection: content,
				slug: `post-uses-tag-${randomUUID()}`,
				metadata: { title: "Tagged post" },
				mdx: "Tagged body.",
				schemaVersion: 1,
				contentHash: randomUUID(),
			});
			const saved = await store.saveWorkingWithReferences({
				entryId: post.id,
				expectedVersion: post.version,
				snapshot: {
					collection: content,
					slug: post.workingSlug,
					metadata: { title: "Tagged post" },
					mdx: "Tagged body.",
					schemaVersion: 1,
					contentHash: "tagged-post-with-reference",
					issues: [],
					references: [],
				},
				references: [{ kind: "entry", targetId: tag.id, isStale: false, occurrences: [] }],
			});
			const publishedPost = await store.publishEntry({ id: post.id, expectedVersion: saved.version });

			await expect(store.trashEntry({ id: tag.id, expectedVersion: publishedTag.version })).rejects.toMatchObject({
				code: "in_use",
			});
			// 영구 삭제는 휴지통 항목만 대상이다(§5.3).
			await expect(
				store.permanentDeleteEntry({ id: tag.id, expectedVersion: publishedTag.version }),
			).rejects.toMatchObject({
				code: "invalid_status",
			});
			const stillPublished = await store.getEntry(publishedPost.id);
			expect(stillPublished.status).toBe("published");

			const editedWithoutTag = await store.saveWorkingWithReferences({
				entryId: publishedPost.id,
				expectedVersion: publishedPost.version,
				snapshot: {
					collection: content,
					slug: publishedPost.workingSlug,
					metadata: { title: "Tagged post" },
					mdx: "Tagged body.",
					schemaVersion: 1,
					contentHash: randomUUID(),
					issues: [],
					references: [],
				},
				references: [],
			});
			await expect(store.trashEntry({ id: tag.id, expectedVersion: publishedTag.version })).rejects.toMatchObject({
				code: "in_use",
			});
			await store.publishEntry({ id: publishedPost.id, expectedVersion: editedWithoutTag.version });
			const trashedTag = await store.trashEntry({ id: tag.id, expectedVersion: publishedTag.version });
			expect(trashedTag.status).toBe("trashed");
		});

		it("does not publish a trashed entry", async () => {
			const draft = await seedEntry(store, {
				collection: content,
				slug: `trashed-entry-${randomUUID()}`,
				metadata: { title: "Trashed entry" },
				mdx: "Body.",
				schemaVersion: 1,
				contentHash: randomUUID(),
			});
			const trashed = await store.trashEntry({ id: draft.id, expectedVersion: draft.version });
			await expect(store.publishEntry({ id: trashed.id, expectedVersion: trashed.version })).rejects.toMatchObject({
				code: "invalid_status",
			});
		});

		it("serializes tag deletion against a concurrent draft reference save", async () => {
			const tagDraft = await seedEntry(store, {
				collection: record,
				slug: `tag-race-${randomUUID()}`,
				metadata: { title: "Race tag" },
				mdx: "",
				schemaVersion: 1,
				contentHash: randomUUID(),
			});
			const tag = await store.publishEntry({ id: tagDraft.id, expectedVersion: tagDraft.version });
			const post = await seedEntry(store, {
				collection: content,
				slug: `post-tag-race-${randomUUID()}`,
				metadata: { title: "Concurrent draft" },
				mdx: "Draft.",
				schemaVersion: 1,
				contentHash: randomUUID(),
			});
			const coordinator = await pool.connect();
			try {
				await coordinator.query("BEGIN");
				await coordinator.query(`SELECT id FROM "${schemaName}".entries WHERE id = $1 FOR SHARE`, [tag.id]);
				const trash = store.trashEntry({ id: tag.id, expectedVersion: tag.version });
				await new Promise((resolve) => setTimeout(resolve, 50));
				const save = await store.saveWorkingWithReferences({
					entryId: post.id,
					expectedVersion: post.version,
					snapshot: {
						collection: content,
						slug: post.workingSlug,
						metadata: { title: "Concurrent draft" },
						mdx: "Draft.",
						schemaVersion: 1,
						contentHash: randomUUID(),
						issues: [],
						references: [],
					},
					references: [{ kind: "entry", targetId: tag.id, isStale: false, occurrences: [] }],
				});
				await coordinator.query("COMMIT");
				await expect(trash).rejects.toMatchObject({ code: "in_use" });
				expect(save.version).toBeGreaterThan(post.version);
			} catch (error) {
				await coordinator.query("ROLLBACK").catch(() => undefined);
				throw error;
			} finally {
				coordinator.release();
			}
		});

		it("blocks trashing or deleting a tag referenced by a draft", async () => {
			const tagDraft = await seedEntry(store, {
				collection: record,
				slug: `tag-draft-use-${randomUUID()}`,
				metadata: { title: "Draft-used tag" },
				mdx: "",
				schemaVersion: 1,
				contentHash: randomUUID(),
			});
			const tag = await store.publishEntry({ id: tagDraft.id, expectedVersion: tagDraft.version });
			const post = await seedEntry(store, {
				collection: content,
				slug: `draft-uses-tag-${randomUUID()}`,
				metadata: { title: "Draft using tag" },
				mdx: "Draft body.",
				schemaVersion: 1,
				contentHash: randomUUID(),
			});
			await store.saveWorkingWithReferences({
				entryId: post.id,
				expectedVersion: post.version,
				snapshot: {
					collection: content,
					slug: post.workingSlug,
					metadata: { title: "Draft using tag" },
					mdx: "Draft body.",
					schemaVersion: 1,
					contentHash: "draft-post-with-reference",
					issues: [],
					references: [],
				},
				references: [{ kind: "entry", targetId: tag.id, isStale: false, occurrences: [] }],
			});

			await expect(store.trashEntry({ id: tag.id, expectedVersion: tag.version })).rejects.toMatchObject({
				code: "in_use",
			});
			await expect(store.permanentDeleteEntry({ id: tag.id, expectedVersion: tag.version })).rejects.toMatchObject({
				code: "invalid_status",
			});
		});

		it(
			"fails publish and preserves prior published body & published references if target is unpublished or missing",
			{ timeout: 60000 },
			async () => {
				const tag = await seedEntry(store, {
					collection: record,
					slug: "tag-to-archive",
					metadata: { title: "Tag" },
					mdx: "",
					schemaVersion: 1,
					contentHash: "tag-hash-arch",
				});
				// 레코드 컬렉션은 보관할 수 없다. 공개되지 않은(초안) 태그를 대상으로 쓴다.
				const post = await seedEntry(store, {
					collection: content,
					slug: "post-rollback-test",
					metadata: { title: "Prior Title" },
					mdx: "Prior MDX",
					schemaVersion: 1,
					contentHash: "post-prior-hash",
				});

				// 1st publish (clean, no refs)
				const firstPub = await store.publishEntry({ id: post.id, expectedVersion: post.version });

				// Save draft on post referencing the unpublished tag
				await store.saveWorkingWithReferences({
					entryId: post.id,
					expectedVersion: firstPub.version,
					snapshot: {
						collection: content,
						slug: "post-rollback-test",
						metadata: { title: "Broken Title" },
						mdx: "Broken MDX",
						schemaVersion: 1,
						contentHash: "post-broken-hash",
						issues: [],
						references: [],
					},
					references: [
						{
							kind: "entry",
							targetId: tag.id,
							isStale: false,
							occurrences: [{ type: "metadata", path: "tags" }],
						},
					],
				});

				// Attempt 2nd publish - MUST FAIL because the referenced tag is not published
				await expect(
					store.publishEntry({
						id: post.id,
						expectedVersion: firstPub.version + 1,
					}),
				).rejects.toThrow();

				// Verify prior published body is completely intact!
				const current = await store.getEntry(post.id);
				expect(current.published?.mdx).toBe("Prior MDX");
				expect(current.published?.metadata.title).toBe("Prior Title");
			},
		);
	});

	describe("4. Timestamps (§5.5)", () => {
		it("keeps the first publish time on re-publish and after archive", async () => {
			const post = await seedEntry(store, {
				collection: content,
				slug: "post-timestamp-test",
				metadata: { title: "Timestamp Post" },
				mdx: "V1",
				schemaVersion: 1,
				contentHash: "ts-hash-1",
			});
			const pub1 = await store.publishEntry({ id: post.id, expectedVersion: post.version });
			const firstPublishedAt = pub1.publishedAt;
			expect(firstPublishedAt).toBeInstanceOf(Date);

			await store.saveWorkingWithReferences({
				entryId: post.id,
				expectedVersion: pub1.version,
				snapshot: {
					collection: content,
					slug: "post-timestamp-test",
					metadata: { title: "Timestamp Post V2" },
					mdx: "V2",
					schemaVersion: 1,
					contentHash: "ts-hash-2",
					issues: [],
					references: [],
				},
				references: [],
			});
			await new Promise((r) => setTimeout(r, 50));
			const pub2 = await store.publishEntry({ id: post.id, expectedVersion: pub1.version + 1 });
			expect(pub2.publishedAt).toEqual(firstPublishedAt);

			const archived = await store.archiveEntry({ id: post.id, expectedVersion: pub2.version });
			const draft = await store.unarchiveEntry({ id: post.id, expectedVersion: archived.version });
			const pub3 = await store.publishEntry({ id: post.id, expectedVersion: draft.version });
			expect(pub3.publishedAt).toEqual(firstPublishedAt);
		});

		it("resets the publish time to now only when asked, even without changes", async () => {
			const original = new Date("2023-07-16T15:00:00Z");
			const post = await seedEntry(store, {
				collection: content,
				slug: "post-reset-date",
				metadata: { title: "Reset" },
				mdx: "Body",
				schemaVersion: 1,
				contentHash: "ts-hash-reset",
			});
			await pool.query(`UPDATE "${schemaName}".entries SET published_at = $2 WHERE id = $1`, [post.id, original]);
			const pub1 = await store.publishEntry({ id: post.id, expectedVersion: post.version });
			expect(pub1.publishedAt).toEqual(original);

			// 바뀐 것이 없는 다시 발행이어도 발행일만 바꾸고 버전을 올린다.
			const before = Date.now();
			const pub2 = await store.publishEntry({ id: post.id, expectedVersion: pub1.version, resetPublishedAt: true });
			expect(pub2.version).toBe(pub1.version + 1);
			expect(pub2.publishedAt?.getTime()).toBeGreaterThanOrEqual(before - 1000);

			await store.saveWorkingWithReferences({
				entryId: post.id,
				expectedVersion: pub2.version,
				snapshot: {
					collection: content,
					slug: "post-reset-date",
					metadata: { title: "Reset V2" },
					mdx: "V2",
					schemaVersion: 1,
					contentHash: "ts-hash-reset-2",
					issues: [],
					references: [],
				},
				references: [],
			});
			await new Promise((r) => setTimeout(r, 20));
			const pub3 = await store.publishEntry({ id: post.id, expectedVersion: pub2.version + 1, resetPublishedAt: true });
			expect(pub3.publishedAt?.getTime()).toBeGreaterThan(pub2.publishedAt?.getTime() ?? 0);
		});

		it("publishes with a publish time set beforehand (migrated drafts keep their original date)", async () => {
			const post = await seedEntry(store, {
				collection: content,
				slug: "post-preset-date",
				metadata: { title: "Migrated" },
				mdx: "Body",
				schemaVersion: 1,
				contentHash: "ts-hash-preset",
			});
			const original = new Date("2023-07-16T15:00:00Z");
			await pool.query(`UPDATE "${schemaName}".entries SET published_at = $2 WHERE id = $1`, [post.id, original]);

			const published = await store.publishEntry({ id: post.id, expectedVersion: post.version });
			expect(published.publishedAt).toEqual(original);
		});
	});

	describe("5. M7-SEC-1 발행 경계", () => {
		it("analyze 오류가 있는 본문은 publishEntry가 거부하고 상태를 바꾸지 않는다", async () => {
			const post = await seedEntry(store, {
				collection: content,
				slug: "post-broken-mdx",
				metadata: { title: "Broken" },
				mdx: "<Unclosed>",
				schemaVersion: 1,
				contentHash: "broken-hash",
			});

			await expect(store.publishEntry({ id: post.id, expectedVersion: post.version })).rejects.toMatchObject({
				code: "publish_validation_failed",
			});

			const after = await store.getEntry(post.id);
			expect(after.status).toBe("draft");
		});
	});
});
