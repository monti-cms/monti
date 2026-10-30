import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { contentCollection, fillRequiredMetadata, recordCollection } from "../../../../test/any-site";
import { testSite } from "../../../../test/site";
import { docOf } from "../../../../test/stored-content";
import { publishDraft, seedEntry } from "../../../core/store/__test__/seed";
import { createContentStore, migrateContentStore } from "../content-store";
import { closeGlobalPool, createIsolatedTestPool, dropIsolatedTestPool } from "./test-database";

/** Collection names are looked up in the current config (`test/any-site.ts`). Posts are the document collection with a body; tags are the item collection. */
const content = contentCollection;
const record = recordCollection;

describe("Publishing, Lifecycle & Published-References Contracts", () => {
	let pool: Pool;
	let schemaName: string;
	let store: ReturnType<typeof createContentStore>;

	beforeAll(async () => {
		const isolated = await createIsolatedTestPool();
		pool = isolated.pool;
		schemaName = isolated.schemaName;

		await migrateContentStore(pool, { site: testSite, schema: schemaName });
		store = createContentStore(pool, { site: testSite, schema: schemaName });
		// Values needed to publish an entry (such as the reference blog's category) are irrelevant to this file's scenarios, so the store fills them in.
		fillRequiredMetadata(store);
	});

	/** How many connections wait for a lock in a query on this schema. */
	const lockWaiters = async () =>
		(
			await pool.query<{ count: number }>(
				"SELECT count(*)::int AS count FROM pg_stat_activity WHERE wait_event_type = 'Lock' AND query LIKE $1",
				[`%"${schemaName}"%`],
			)
		).rows[0]?.count ?? 0;

	afterAll(async () => {
		if (pool && schemaName) {
			await dropIsolatedTestPool(pool, schemaName);
		}
		await closeGlobalPool();
	});

	describe("2. Transactional Target Recheck & Published References Rollback", () => {
		it("TRASH-T9 lets a trash wait for a concurrent draft reference save to the tag, then go through", async () => {
			const tagDraft = await seedEntry(store, {
				collection: record,
				slug: `tag-race-${randomUUID()}`,
				metadata: { title: "Race tag" },
				text: "",
				contentHash: randomUUID(),
			});
			const tag = await publishDraft(testSite, store, { id: tagDraft.id, expectedVersion: tagDraft.version });
			const post = await seedEntry(store, {
				collection: content,
				slug: `post-tag-race-${randomUUID()}`,
				metadata: { title: "Concurrent draft" },
				text: "Draft.",
				contentHash: randomUUID(),
			});
			const coordinator = await pool.connect();
			try {
				await coordinator.query("BEGIN");
				await coordinator.query(`SELECT id FROM "${schemaName}".entries WHERE id = $1 FOR SHARE`, [tag.id]);
				const trash = store.trashEntry({ id: tag.id, expectedVersion: tag.version });
				// The trash waits for the coordinator's lock on the tag.
				await expect.poll(lockWaiters).toBe(1);
				const save = await store.saveWorkingWithReferences({
					entryId: post.id,
					expectedVersion: post.version,
					snapshot: {
						collection: content,
						slug: post.workingSlug,
						metadata: { title: "Concurrent draft" },
						doc: docOf("Draft."),
						contentHash: randomUUID(),
						issues: [],
						references: [],
						imageSources: [],
					},
					references: [{ kind: "entry", targetId: tag.id, isStale: false, occurrences: [] }],
				});
				await coordinator.query("COMMIT");
				await expect(trash).resolves.toMatchObject({ status: "trashed" });
				expect(save.version).toBeGreaterThan(post.version);
			} catch (error) {
				await coordinator.query("ROLLBACK").catch(() => undefined);
				throw error;
			} finally {
				coordinator.release();
			}
		});
	});

	describe("4. Timestamps", () => {
		it("resets the publish time to now only when asked, even without changes", async () => {
			const original = new Date("2023-07-16T15:00:00Z");
			const post = await seedEntry(store, {
				collection: content,
				slug: "post-reset-date",
				metadata: { title: "Reset" },
				text: "Body",
				contentHash: "ts-hash-reset",
			});
			await pool.query(`UPDATE "${schemaName}".entries SET published_at = $2 WHERE id = $1`, [post.id, original]);
			const pub1 = await publishDraft(testSite, store, { id: post.id, expectedVersion: post.version });
			expect(pub1.publishedAt).toEqual(original);

			// Even a re-publish with no changes updates only the publish date and bumps the version.
			const before = Date.now();
			const pub2 = await publishDraft(testSite, store, {
				id: post.id,
				expectedVersion: pub1.version,
				resetPublishedAt: true,
			});
			expect(pub2.version).toBe(pub1.version + 1);
			expect(pub2.publishedAt?.getTime()).toBeGreaterThanOrEqual(before - 1000);

			await store.saveWorkingWithReferences({
				entryId: post.id,
				expectedVersion: pub2.version,
				snapshot: {
					collection: content,
					slug: "post-reset-date",
					metadata: { title: "Reset V2" },
					doc: docOf("V2"),
					contentHash: "ts-hash-reset-2",
					issues: [],
					references: [],
					imageSources: [],
				},
				references: [],
			});
			// The publish time is set back, so the reset below has to move it to now.
			await pool.query(`UPDATE "${schemaName}".entries SET published_at = $2 WHERE id = $1`, [post.id, original]);
			const pub3 = await publishDraft(testSite, store, {
				id: post.id,
				expectedVersion: pub2.version + 1,
				resetPublishedAt: true,
			});
			expect(pub3.publishedAt?.getTime()).toBeGreaterThanOrEqual(before - 1000);
		});

		it("publishes with a publish time set beforehand (migrated drafts keep their original date)", async () => {
			const post = await seedEntry(store, {
				collection: content,
				slug: "post-preset-date",
				metadata: { title: "Migrated" },
				text: "Body",
				contentHash: "ts-hash-preset",
			});
			const original = new Date("2023-07-16T15:00:00Z");
			await pool.query(`UPDATE "${schemaName}".entries SET published_at = $2 WHERE id = $1`, [post.id, original]);

			const published = await publishDraft(testSite, store, { id: post.id, expectedVersion: post.version });
			expect(published.publishedAt).toEqual(original);
		});
	});
});
