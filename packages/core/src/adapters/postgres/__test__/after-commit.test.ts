import type { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { contentCollection, fillRequiredMetadata } from "../../../../test/any-site";
import type { ContentChange } from "../../../core/store";
import { publishDraft, restoreDraft, seedEntry } from "../../../core/store/__test__/seed";
import { createContentStore, migrateContentStore } from "../content-store";
import { closeGlobalPool, createIsolatedTestPool, dropIsolatedTestPool } from "./test-database";

/** Post-save notification: only committed changes are reported, and a failed notification does not roll back the save. */
describe("post-save notification afterCommit", () => {
	let pool: Pool;
	let schemaName: string;
	const changes: ContentChange[] = [];
	let failNext = false;
	let store: ReturnType<typeof createContentStore>;

	beforeAll(async () => {
		const isolated = await createIsolatedTestPool();
		pool = isolated.pool;
		schemaName = isolated.schemaName;
		await migrateContentStore(pool, { schema: schemaName });
		store = createContentStore(pool, {
			schema: schemaName,
			afterCommit: (change) => {
				if (failNext) {
					failNext = false;
					throw new Error("hook failed");
				}
				changes.push(change);
			},
		});
		fillRequiredMetadata(store);
	});

	beforeEach(() => {
		changes.length = 0;
	});

	afterAll(async () => {
		if (pool && schemaName) await dropIsolatedTestPool(pool, schemaName);
		await closeGlobalPool();
	});

	const create = (slug: string) =>
		seedEntry(store, { collection: contentCollection, slug, metadata: { title: slug }, mdx: "본문" });

	it("reports create, publish, archive, trash, restore, and permanent delete after commit", async () => {
		const entry = await create("after-commit-flow");
		// When a required relation target is first created, that item also arrives as "created". Look only at this entry's notifications.
		expect(changes.at(-1)).toMatchObject({ kind: "created", entryId: entry.id, status: "draft" });
		changes.length = 0;
		const published = await publishDraft(store, { id: entry.id, expectedVersion: entry.version });
		const archived = await store.archiveEntry({ id: entry.id, expectedVersion: published.version });
		const trashed = await store.trashEntry({ id: entry.id, expectedVersion: archived.version });
		const restored = await restoreDraft(store, { id: entry.id, expectedVersion: trashed.version });
		const again = await store.trashEntry({ id: entry.id, expectedVersion: restored.version });
		await store.permanentDeleteEntry({ id: entry.id, expectedVersion: again.version });

		expect(changes.map((change) => change.kind)).toEqual([
			"published",
			"archived",
			"trashed",
			"restored",
			"trashed",
			"deleted",
		]);
		expect(changes[0]).toMatchObject({
			entryId: entry.id,
			collection: contentCollection,
			locale: entry.locale,
			translationGroupId: entry.id,
			status: "published",
			publishedSlug: "after-commit-flow",
		});
	});

	it("does not report rolled-back changes (version conflict)", async () => {
		const entry = await create("after-commit-conflict");
		changes.length = 0;
		await expect(publishDraft(store, { id: entry.id, expectedVersion: entry.version + 5 })).rejects.toMatchObject({
			code: "conflict",
		});
		expect(changes).toEqual([]);
	});

	it("keeps the save committed even if the notification fails", async () => {
		const entry = await create("after-commit-failing-hook");
		failNext = true;
		const published = await publishDraft(store, { id: entry.id, expectedVersion: entry.version });
		expect(published.status).toBe("published");
		expect((await store.getEntry(entry.id)).status).toBe("published");
	});
});
