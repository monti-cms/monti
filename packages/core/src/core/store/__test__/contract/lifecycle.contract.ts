import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { contentCollection, fillRequiredMetadata, recordCollection } from "../../../../../test/any-site";
import { testSite } from "../../../../../test/site";
import { contentOf, docOf } from "../../../../../test/stored-content";
import { unparsedDocument } from "../../../../doc/stored-document";
import type { ContentStore } from "../../ports";
import { publishDraft, restoreDraft, seedEntry } from "../seed";
import type { ContractSuite, StoreSession } from "./harness";

/** Collection names are looked up in the current config (`test/any-site.ts`). Posts are the document collection with a body; tags are the item collection. */
const content = contentCollection;
const record = recordCollection;

/** Contract of LifecycleStore: publishing, lifecycle transitions and published references. */
export const lifecycleContract: ContractSuite = (factory) => {
	describe("LifecycleStore: publishing, lifecycle & published references", () => {
		let session: StoreSession;
		let store: ContentStore;

		beforeAll(async () => {
			session = await factory.create();
			store = session.store;
			// Values needed to publish an entry (such as the reference blog's category) are irrelevant to this file's scenarios, so the store fills them in.
			fillRequiredMetadata(store);
		});

		afterAll(async () => {
			await session.close();
		});

		describe("1. Lifecycle State Machine Transitions", () => {
			it("draft -> published creates published body and sets status to published", async () => {
				const entry = await seedEntry(store, {
					collection: content,
					slug: "test-publish-1",
					metadata: { title: "Draft Post" },
					text: "Content 1",
					contentHash: "hash-1",
				});

				expect(entry.status).toBe("draft");
				expect(entry.publishedAt).toBeUndefined();

				// The publish date is the time of first publish.
				const before = Date.now();
				const published = await publishDraft(testSite, store, { id: entry.id, expectedVersion: entry.version });

				expect(published.status).toBe("published");
				expect(published.publishedAt?.getTime()).toBeGreaterThanOrEqual(before - 1000);
				expect(published.publishedAt?.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
			});

			it("published -> archive closes public visibility", async () => {
				const entry = await seedEntry(store, {
					collection: content,
					slug: "test-archive-1",
					metadata: { title: "To Archive" },
					text: "Content",
					contentHash: "hash-arch",
				});

				const pub = await publishDraft(testSite, store, {
					id: entry.id,
					expectedVersion: entry.version,
				});

				const archived = await store.archiveEntry({
					id: entry.id,
					expectedVersion: pub.version,
				});

				expect(archived.status).toBe("archived");
				expect(archived.publishedAt).toEqual(pub.publishedAt); // preserved
			});

			it("archived -> unarchive returns to draft without auto-publishing", async () => {
				const entry = await seedEntry(store, {
					collection: content,
					slug: "test-unarchive-1",
					metadata: { title: "To Unarchive" },
					text: "Content",
					contentHash: "hash-unarch",
				});

				const pub = await publishDraft(testSite, store, {
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

			it("TRASH-T1 draft/published/archived -> trash hides from active list", async () => {
				const entry = await seedEntry(store, {
					collection: content,
					slug: "test-trash-1",
					metadata: { title: "To Trash" },
					text: "Content",
					contentHash: "hash-trash",
				});

				const trashed = await store.trashEntry({
					id: entry.id,
					expectedVersion: entry.version,
				});

				expect(trashed.status).toBe("trashed");
			});

			it("TRASH-R1 trashed -> restore returns to draft (for publish collection)", async () => {
				const entry = await seedEntry(store, {
					collection: content,
					slug: "test-restore-1",
					metadata: { title: "To Restore" },
					text: "Content",
					contentHash: "hash-res",
				});

				const trashed = await store.trashEntry({
					id: entry.id,
					expectedVersion: entry.version,
				});

				const restored = await restoreDraft(testSite, store, {
					id: entry.id,
					expectedVersion: trashed.version,
				});

				expect(restored.status).toBe("draft");
			});

			it("TRASH-D5 trashed -> permanentDelete deletes entry but preserves address tombstone", async () => {
				const entry = await seedEntry(store, {
					collection: content,
					slug: "test-perm-delete-1",
					metadata: { title: "Perm Delete" },
					text: "Content",
					contentHash: "hash-perm",
				});

				const pub = await publishDraft(testSite, store, {
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
						text: "Content",
						contentHash: "hash-reuse",
					}),
				).rejects.toThrow(/conflict|Slug conflict/i);
			});
		});

		describe("2. Transactional Target Recheck & Published References Rollback", () => {
			it("publishes and copies working references to published references atomically", async () => {
				const tag = await seedEntry(store, {
					collection: record,
					slug: "tag-active",
					metadata: { title: "Active Tag" },
					text: "",
					contentHash: "tag-hash",
				});

				// tag must be published or active
				await publishDraft(testSite, store, { id: tag.id, expectedVersion: tag.version });

				const post = await seedEntry(store, {
					collection: content,
					slug: "post-with-ref",
					metadata: { title: "Post" },
					text: "Hello",
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
						doc: docOf("Hello"),
						contentHash: "post-hash-2",
						issues: [],
						references: [],
						imageSources: [],
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
				const pubPost = await publishDraft(testSite, store, {
					id: post.id,
					expectedVersion: post.version + 1,
				});

				expect(pubPost.status).toBe("published");

				// The published references of the post, as seen from the tag they point at.
				const incoming = await store.getIncomingReferences({ targetId: tag.id });
				const pubRefs = incoming.filter((item) => item.state === "published" && item.sourceId === post.id);
				expect(pubRefs).toHaveLength(1);
				expect(pubRefs[0]?.occurrences).toEqual([{ type: "metadata", path: "tags" }]);
			});

			it("TRASH-T9 trashes a tag still used by published entries, and holds back only its permanent delete", async () => {
				const tag = await seedEntry(store, {
					collection: record,
					slug: `tag-in-use-${randomUUID()}`,
					metadata: { title: "In-use tag" },
					text: "",
					contentHash: randomUUID(),
				});
				const publishedTag = await publishDraft(testSite, store, { id: tag.id, expectedVersion: tag.version });
				const post = await seedEntry(store, {
					collection: content,
					slug: `post-uses-tag-${randomUUID()}`,
					metadata: { title: "Tagged post" },
					text: "Tagged body.",
					contentHash: randomUUID(),
				});
				const saved = await store.saveWorkingWithReferences({
					entryId: post.id,
					expectedVersion: post.version,
					snapshot: {
						collection: content,
						slug: post.workingSlug,
						metadata: { title: "Tagged post" },
						doc: docOf("Tagged body."),
						contentHash: "tagged-post-with-reference",
						issues: [],
						references: [],
						imageSources: [],
					},
					references: [
						{ kind: "entry", targetId: tag.id, isStale: false, occurrences: [{ type: "metadata", path: "tags" }] },
					],
				});
				const publishedPost = await publishDraft(testSite, store, { id: post.id, expectedVersion: saved.version });

				// Permanent delete targets only trashed entries.
				await expect(
					store.permanentDeleteEntry({ id: tag.id, expectedVersion: publishedTag.version }),
				).rejects.toMatchObject({
					code: "invalid_status",
				});
				const trashedTag = await store.trashEntry({ id: tag.id, expectedVersion: publishedTag.version });
				expect(trashedTag.status).toBe("trashed");
				expect((await store.getEntry(publishedPost.id)).status).toBe("published");

				// The relation field of the post still points at it, so it cannot be deleted for good, and the post is named.
				await expect(
					store.permanentDeleteEntry({ id: tag.id, expectedVersion: trashedTag.version }),
				).rejects.toMatchObject({
					code: "in_use",
					details: { usages: [expect.objectContaining({ entryId: post.id, collection: content, trashed: false })] },
				});

				const editedWithoutTag = await store.saveWorkingWithReferences({
					entryId: publishedPost.id,
					expectedVersion: publishedPost.version,
					snapshot: {
						collection: content,
						slug: publishedPost.workingSlug,
						metadata: { title: "Tagged post" },
						doc: docOf("Tagged body."),
						contentHash: randomUUID(),
						issues: [],
						references: [],
						imageSources: [],
					},
					references: [],
				});
				await publishDraft(testSite, store, { id: publishedPost.id, expectedVersion: editedWithoutTag.version });
				await store.permanentDeleteEntry({ id: tag.id, expectedVersion: trashedTag.version });
				await expect(store.getEntry(tag.id)).rejects.toMatchObject({ code: "not_found" });
			});

			it("TRASH-T7 does not publish a trashed entry", async () => {
				const draft = await seedEntry(store, {
					collection: content,
					slug: `trashed-entry-${randomUUID()}`,
					metadata: { title: "Trashed entry" },
					text: "Body.",
					contentHash: randomUUID(),
				});
				const trashed = await store.trashEntry({ id: draft.id, expectedVersion: draft.version });
				await expect(
					publishDraft(testSite, store, { id: trashed.id, expectedVersion: trashed.version }),
				).rejects.toMatchObject({
					code: "invalid_status",
				});
			});

			it("TRASH-T9 holds back the permanent delete of a tag a draft points at, not its trash", async () => {
				const tagDraft = await seedEntry(store, {
					collection: record,
					slug: `tag-draft-use-${randomUUID()}`,
					metadata: { title: "Draft-used tag" },
					text: "",
					contentHash: randomUUID(),
				});
				const tag = await publishDraft(testSite, store, { id: tagDraft.id, expectedVersion: tagDraft.version });
				const post = await seedEntry(store, {
					collection: content,
					slug: `draft-uses-tag-${randomUUID()}`,
					metadata: { title: "Draft using tag" },
					text: "Draft body.",
					contentHash: randomUUID(),
				});
				await store.saveWorkingWithReferences({
					entryId: post.id,
					expectedVersion: post.version,
					snapshot: {
						collection: content,
						slug: post.workingSlug,
						metadata: { title: "Draft using tag" },
						doc: docOf("Draft body."),
						contentHash: "draft-post-with-reference",
						issues: [],
						references: [],
						imageSources: [],
					},
					references: [
						{ kind: "entry", targetId: tag.id, isStale: false, occurrences: [{ type: "metadata", path: "tags" }] },
					],
				});

				const trashedTag = await store.trashEntry({ id: tag.id, expectedVersion: tag.version });
				await expect(
					store.permanentDeleteEntry({ id: tag.id, expectedVersion: trashedTag.version }),
				).rejects.toMatchObject({
					code: "in_use",
					details: { usages: [expect.objectContaining({ entryId: post.id })] },
				});
			});

			it("fails publish and preserves prior published body & published references if target is unpublished or missing", async () => {
				const tag = await seedEntry(store, {
					collection: record,
					slug: "tag-to-archive",
					metadata: { title: "Tag" },
					text: "",
					contentHash: "tag-hash-arch",
				});
				// A record collection cannot be archived. Use an unpublished (draft) tag as the target.
				const post = await seedEntry(store, {
					collection: content,
					slug: "post-rollback-test",
					metadata: { title: "Prior Title" },
					text: "Prior body",
					contentHash: "post-prior-hash",
				});

				// 1st publish (clean, no refs)
				const firstPub = await publishDraft(testSite, store, { id: post.id, expectedVersion: post.version });

				// Save draft on post referencing the unpublished tag
				await store.saveWorkingWithReferences({
					entryId: post.id,
					expectedVersion: firstPub.version,
					snapshot: {
						collection: content,
						slug: "post-rollback-test",
						metadata: { title: "Broken Title" },
						doc: docOf("Broken body"),
						contentHash: "post-broken-hash",
						issues: [],
						references: [],
						imageSources: [],
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
					publishDraft(testSite, store, {
						id: post.id,
						expectedVersion: firstPub.version + 1,
					}),
				).rejects.toThrow();

				// Verify prior published body is completely intact!
				const current = await store.getEntry(post.id);
				expect(contentOf(current.published?.doc)).toEqual(contentOf(docOf("Prior body")));
				expect(current.published?.metadata.title).toBe("Prior Title");
			});
		});

		describe("4. Timestamps", () => {
			it("keeps the first publish time on re-publish and after archive", async () => {
				// The store stamps a publish with the application clock; each publish runs at a later time of its own.
				const firstPublishedAt = new Date("2026-01-01T00:00:00.000Z");
				vi.useFakeTimers({ toFake: ["Date"], now: firstPublishedAt });
				try {
					const post = await seedEntry(store, {
						collection: content,
						slug: "post-timestamp-test",
						metadata: { title: "Timestamp Post" },
						text: "V1",
						contentHash: "ts-hash-1",
					});
					const pub1 = await publishDraft(testSite, store, { id: post.id, expectedVersion: post.version });
					expect(pub1.publishedAt).toEqual(firstPublishedAt);

					vi.setSystemTime(new Date("2026-01-01T00:01:00.000Z"));
					await store.saveWorkingWithReferences({
						entryId: post.id,
						expectedVersion: pub1.version,
						snapshot: {
							collection: content,
							slug: "post-timestamp-test",
							metadata: { title: "Timestamp Post V2" },
							doc: docOf("V2"),
							contentHash: "ts-hash-2",
							issues: [],
							references: [],
							imageSources: [],
						},
						references: [],
					});
					const pub2 = await publishDraft(testSite, store, { id: post.id, expectedVersion: pub1.version + 1 });
					expect(pub2.publishedAt).toEqual(firstPublishedAt);

					vi.setSystemTime(new Date("2026-01-01T00:02:00.000Z"));
					const archived = await store.archiveEntry({ id: post.id, expectedVersion: pub2.version });
					const draft = await store.unarchiveEntry({ id: post.id, expectedVersion: archived.version });
					const pub3 = await publishDraft(testSite, store, { id: post.id, expectedVersion: draft.version });
					expect(pub3.publishedAt).toEqual(firstPublishedAt);
				} finally {
					vi.useRealTimers();
				}
			});
		});

		describe("5. Publish boundary", () => {
			it("rejects a body that could not be read in publishEntry and leaves the status unchanged", async () => {
				const post = await seedEntry(store, {
					collection: content,
					slug: "post-unparsed",
					metadata: { title: "Broken" },
					doc: unparsedDocument("<<<Unclosed", null, "paragraphs"),
					contentHash: "broken-hash",
				});

				await expect(
					publishDraft(testSite, store, { id: post.id, expectedVersion: post.version }),
				).rejects.toMatchObject({
					code: "publish_validation_failed",
				});

				const after = await store.getEntry(post.id);
				expect(after.status).toBe("draft");
			});
		});
	});
};
