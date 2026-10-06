import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { contentCollection, fillRequiredMetadata } from "../../../../test/any-site";
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

		await migrateContentStore(pool, { schema: schemaName });
		store = createContentStore(pool, { schema: schemaName });
		// Required-for-publish values (such as the reference blog's category) are looked up in the config and filled in.
		fillRequiredMetadata(store);
	});

	afterAll(async () => {
		if (pool && schemaName) {
			await dropIsolatedTestPool(pool, schemaName);
		}
		await closeGlobalPool();
	});

	describe("a syntax-only change (same content hash, different MDX string)", () => {
		const searchTextOf = async (entryId: string, state: "working" | "published") =>
			(
				await pool.query<{ mdx: string; search_text: string }>(
					`SELECT mdx, search_text FROM "${schemaName}".entry_bodies WHERE entry_id = $1 AND state = $2`,
					[entryId, state],
				)
			).rows[0];

		it("stores the new MDX and search text without a version bump or a new updatedAt", async () => {
			const entry = await seedEntry(store, {
				collection: contentCollection,
				slug: "syntax-only-save",
				metadata: { title: "Syntax" },
				mdx: "first words",
				contentHash: "hash-syntax-only",
			});

			const saved = await seedSave(store, entry.id, {
				expectedVersion: entry.version,
				metadata: { title: "Syntax" },
				mdx: "second words",
				contentHash: "hash-syntax-only",
			});

			expect(saved.version).toBe(entry.version);
			expect(saved.updatedAt.getTime()).toBe(entry.updatedAt.getTime());
			expect(saved.working.updatedAt?.getTime()).toBe(entry.working.updatedAt?.getTime());
			// The MDX column is written from the document (which ends its text with a newline).
			expect(saved.working.mdx).toBe("second words\n");
			expect(await searchTextOf(entry.id, "working")).toMatchObject({
				mdx: "second words\n",
				search_text: "second words",
			});
		});
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

		const firstPublish = await publishDraft(store, { id: entry.id, expectedVersion: entry.version });

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

		await expect(publishDraft(failingStore, { id: entry.id, expectedVersion: update.version })).rejects.toThrow();

		expect(hookReached).toBe(true);

		const reloaded = await store.getEntry(entry.id);
		expect(reloaded).toEqual(capturedState);
	});
});
