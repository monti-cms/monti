import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { contentCollection, fillRequiredMetadata } from "../../../../test/any-site";
import { testSite } from "../../../../test/site";
import { publishDraft, seedEntry, seedSave } from "../../../core/store/__test__/seed";
import { createContentStore, migrateContentStore } from "../content-store";
import { closeGlobalPool, createIsolatedTestPool, dropIsolatedTestPool } from "./test-database";

/** What the Postgres content store does with its own tables and hooks. The behavior every store shows is in the store contract. */
describe("ContentStore (Postgres)", () => {
	let pool: Pool;
	let schemaName: string;
	let store: ReturnType<typeof createContentStore>;

	beforeAll(async () => {
		const isolated = await createIsolatedTestPool();
		pool = isolated.pool;
		schemaName = isolated.schemaName;

		await migrateContentStore(pool, { site: testSite, schema: schemaName });
		store = createContentStore(pool, { site: testSite, schema: schemaName });
		// Required-for-publish values (such as the reference blog's category) are looked up in the config and filled in.
		fillRequiredMetadata(store);
	});

	afterAll(async () => {
		if (pool && schemaName) {
			await dropIsolatedTestPool(pool, schemaName);
		}
		await closeGlobalPool();
	});

	describe("a syntax-only change (same content hash, different text)", () => {
		const searchTextOf = async (entryId: string, state: "working" | "published") =>
			(
				await pool.query<{ search_text: string }>(
					`SELECT search_text FROM "${schemaName}".entry_bodies WHERE entry_id = $1 AND state = $2`,
					[entryId, state],
				)
			).rows[0];

		it("stores the new search text without a version bump or a new updatedAt", async () => {
			const entry = await seedEntry(store, {
				collection: contentCollection,
				slug: "syntax-only-save",
				metadata: { title: "Syntax" },
				text: "first words",
				contentHash: "hash-syntax-only",
			});

			const saved = await seedSave(store, entry.id, {
				expectedVersion: entry.version,
				metadata: { title: "Syntax" },
				text: "second words",
				contentHash: "hash-syntax-only",
			});

			expect(saved.version).toBe(entry.version);
			expect(saved.updatedAt.getTime()).toBe(entry.updatedAt.getTime());
			expect(saved.working.updatedAt?.getTime()).toBe(entry.working.updatedAt?.getTime());
			expect(await searchTextOf(entry.id, "working")).toMatchObject({ search_text: "second words" });
		});
	});

	it("a transaction failure during publish leaves the prior published snapshot intact", async () => {
		const entry = await seedEntry(store, {
			collection: contentCollection,
			slug: "rollback-test",
			metadata: { title: "First Publish" },
			text: "first publish",
			schemaVersion: 1,
			contentHash: "hash-rollback-1",
		});

		const firstPublish = await publishDraft(testSite, store, { id: entry.id, expectedVersion: entry.version });

		const update = await seedSave(store, entry.id, {
			expectedVersion: firstPublish.version,
			metadata: { title: "Second Publish" },
			text: "second publish",
			schemaVersion: 1,
			contentHash: "hash-rollback-2",
		});

		const capturedState = await store.getEntry(entry.id);

		let hookReached = false;
		const failingStore = createContentStore(pool, {
			site: testSite,
			schema: schemaName,
			beforePublishCommit: async () => {
				hookReached = true;
				throw new Error("Simulated publish failure");
			},
		});

		await expect(
			publishDraft(testSite, failingStore, { id: entry.id, expectedVersion: update.version }),
		).rejects.toThrow();

		expect(hookReached).toBe(true);

		const reloaded = await store.getEntry(entry.id);
		expect(reloaded).toEqual(capturedState);
	});
});
