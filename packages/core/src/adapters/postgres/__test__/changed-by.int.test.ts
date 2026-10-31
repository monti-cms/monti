import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { contentCollection, fillRequiredMetadata } from "../../../../test/any-site";
import { testSite } from "../../../../test/site";
import { withActor } from "../../../core/actor";
import { seedEntry, seedSave } from "../../../core/store/__test__/seed";
import { createContentStore, migrateContentStore } from "../content-store";
import { closeGlobalPool, createIsolatedTestPool, dropIsolatedTestPool } from "./test-database";

/** Every change that raises an entry's version records who made it and when, for the edit screen's conflict dialog. */
describe("who made the latest change of an entry (Postgres)", () => {
	let pool: Pool;
	let schemaName: string;
	let store: ReturnType<typeof createContentStore>;

	beforeAll(async () => {
		const isolated = await createIsolatedTestPool();
		pool = isolated.pool;
		schemaName = isolated.schemaName;
		await migrateContentStore(pool, { site: testSite, schema: schemaName });
		store = createContentStore(pool, { site: testSite, schema: schemaName });
		fillRequiredMetadata(store);
	});

	afterAll(async () => {
		if (pool && schemaName) await dropIsolatedTestPool(pool, schemaName);
		await closeGlobalPool();
	});

	const draft = (text = "first") =>
		seedEntry(store, {
			collection: contentCollection,
			slug: `changed-by-${randomUUID()}`,
			metadata: { title: "Changed by" },
			text,
			contentHash: randomUUID(),
		});

	it("WRITE-W14 records the admin who saved the draft, and the time of the save", async () => {
		const entry = await draft();
		const before = Date.now();
		const saved = await withActor("Mina", () =>
			seedSave(store, entry.id, { expectedVersion: entry.version, metadata: { title: "Changed by" }, text: "second" }),
		);
		expect(saved.changedBy).toBe("Mina");
		expect(saved.changedAt?.getTime()).toBeGreaterThanOrEqual(before - 1000);
		const read = await store.getEntry(entry.id);
		expect(read.changedBy).toBe("Mina");
		expect(read.changedAt?.getTime()).toBe(saved.changedAt?.getTime());
	});
});
