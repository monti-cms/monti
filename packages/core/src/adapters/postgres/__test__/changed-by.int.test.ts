import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { contentCollection, fillRequiredMetadata } from "../../../../test/any-site";
import { testSite } from "../../../../test/site";
import { withActor } from "../../../core/actor";
import { publishDraft, seedEntry, seedSave } from "../../../core/store/__test__/seed";
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

	it("a new entry has a change time and no author", async () => {
		const entry = await draft();
		expect(entry.changedBy).toBeUndefined();
		expect(entry.changedAt?.getTime()).toBe(entry.updatedAt.getTime());
	});

	it("records the admin who saved the draft, and the time of the save", async () => {
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

	it("the next admin who saves replaces the name, and a write with no actor clears it instead of keeping a stale name", async () => {
		const entry = await draft();
		const first = await withActor("Mina", () =>
			seedSave(store, entry.id, { expectedVersion: entry.version, metadata: { title: "Changed by" }, text: "a" }),
		);
		const second = await withActor("Joon", () =>
			seedSave(store, entry.id, { expectedVersion: first.version, metadata: { title: "Changed by" }, text: "b" }),
		);
		expect(second.changedBy).toBe("Joon");
		const third = await seedSave(store, entry.id, {
			expectedVersion: second.version,
			metadata: { title: "Changed by" },
			text: "c",
		});
		expect(third.changedBy).toBeUndefined();
	});

	it("an identical save does not count as a change", async () => {
		const hash = randomUUID();
		const entry = await seedEntry(store, {
			collection: contentCollection,
			slug: `changed-by-${randomUUID()}`,
			metadata: { title: "Changed by" },
			text: "same",
			contentHash: hash,
		});
		const saved = await withActor("Mina", () =>
			seedSave(store, entry.id, {
				expectedVersion: entry.version,
				metadata: { title: "Changed by" },
				text: "same",
				contentHash: hash,
			}),
		);
		expect(saved.version).toBe(entry.version);
		expect(saved.changedBy).toBeUndefined();
	});

	it("records who published, archived, unarchived and trashed it", async () => {
		const entry = await draft();
		const published = await withActor("Mina", () =>
			publishDraft(testSite, store, { id: entry.id, expectedVersion: entry.version }),
		);
		expect(published.changedBy).toBe("Mina");
		const archived = await withActor("Joon", () =>
			store.archiveEntry({ id: entry.id, expectedVersion: published.version }),
		);
		expect(archived.changedBy).toBe("Joon");
		const unarchived = await withActor("Ara", () =>
			store.unarchiveEntry({ id: entry.id, expectedVersion: archived.version }),
		);
		expect(unarchived.changedBy).toBe("Ara");
		const trashed = await withActor("Bo", () =>
			store.trashEntry({ id: entry.id, expectedVersion: unarchived.version }),
		);
		expect(trashed.changedBy).toBe("Bo");
		expect(trashed.changedAt?.getTime()).toBeGreaterThanOrEqual(entry.createdAt.getTime());
	});

	it("keeps the actor of each request apart when requests overlap", async () => {
		const entries = await Promise.all([draft("one"), draft("two")]);
		const saved = await Promise.all(
			entries.map((entry, index) =>
				withActor(index === 0 ? "Mina" : "Joon", async () => {
					await new Promise((resolve) => setTimeout(resolve, index === 0 ? 30 : 0));
					return seedSave(store, entry.id, {
						expectedVersion: entry.version,
						metadata: { title: "Changed by" },
						text: `edited ${index}`,
					});
				}),
			),
		);
		expect(saved.map((entry) => entry.changedBy)).toEqual(["Mina", "Joon"]);
	});
});
