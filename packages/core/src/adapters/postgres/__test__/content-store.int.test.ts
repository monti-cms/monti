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

	it("WRITE-P6 a transaction failure during publish leaves the prior published snapshot intact", async () => {
		const entry = await seedEntry(store, {
			collection: contentCollection,
			slug: "rollback-test",
			metadata: { title: "First Publish" },
			text: "first publish",
			contentHash: "hash-rollback-1",
		});

		const firstPublish = await publishDraft(testSite, store, { id: entry.id, expectedVersion: entry.version });

		const update = await seedSave(store, entry.id, {
			expectedVersion: firstPublish.version,
			metadata: { title: "Second Publish" },
			text: "second publish",
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
