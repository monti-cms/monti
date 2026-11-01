import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { contentCollection, fillRequiredMetadata } from "../../../../../test/any-site";
import { testSite } from "../../../../../test/site";
import { docOf } from "../../../../../test/stored-content";
import { publishDraft, seedEntry } from "../../../../core/store/__test__/seed";
import { closeGlobalPool, createIsolatedTestPool, dropIsolatedTestPool } from "../../__test__/test-database";
import { createContentStore, migrateContentStore } from "../../content-store";

/** Collection names are looked up in the current config (`test/any-site.ts`). Posts are the document collection with a body; tags are the item collection. */
const content = contentCollection;

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

	afterAll(async () => {
		if (pool && schemaName) {
			await dropIsolatedTestPool(pool, schemaName);
		}
		await closeGlobalPool();
	});

	describe("4. Timestamps", () => {
		it("WRITE-P5 resets the publish time to now only when asked, even without changes", async () => {
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

		it("WRITE-P5 publishes with a publish time set beforehand (migrated drafts keep their original date)", async () => {
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
