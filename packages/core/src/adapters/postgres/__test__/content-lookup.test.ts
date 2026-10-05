import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { contentCollection, defaultLocale } from "../../../../test/any-site";
import { createContentStore, migrateContentStore } from "../content-store";
import { createContentLookup } from "../store/content-lookup";
import { seedEntry, seedSave } from "./seed";
import { closeGlobalPool, createIsolatedTestPool, dropIsolatedTestPool } from "./test-database";

describe("core content lookup", () => {
	let pool: Pool;
	let schemaName: string;
	let store: ReturnType<typeof createContentStore>;
	let lookup: ReturnType<typeof createContentLookup>;

	beforeAll(async () => {
		const isolated = await createIsolatedTestPool();
		pool = isolated.pool;
		schemaName = isolated.schemaName;
		await migrateContentStore(pool, { schema: schemaName });
		store = createContentStore(pool, { schema: schemaName });
		lookup = createContentLookup({ pool, schema: schemaName });
	});

	afterAll(async () => {
		if (pool && schemaName) await dropIsolatedTestPool(pool, schemaName);
		await closeGlobalPool();
	});

	const seed = async (slug: string) => {
		const entry = await seedEntry(store, {
			collection: contentCollection,
			slug: null,
			metadata: { title: slug },
			mdx: "Body",
			locale: defaultLocale,
		});
		return seedSave(store, entry.id, {
			expectedVersion: entry.version,
			slug,
			metadata: { title: slug },
			mdx: "Body",
		});
	};

	it("returns slugs used in the same collection and language, excluding the entry being edited", async () => {
		const used = await seed("lookup-used");
		await seed("lookup-other");

		const params = { collection: contentCollection, locale: defaultLocale };
		expect(await lookup.slugsInUse({ ...params, slugs: ["lookup-used", "lookup-free"] })).toEqual(
			new Set(["lookup-used"]),
		);
		expect(
			await lookup.slugsInUse({ ...params, slugs: ["lookup-used", "lookup-other"], excludeEntryId: used.id }),
		).toEqual(new Set(["lookup-other"]));
		// A different language does not conflict.
		expect(await lookup.slugsInUse({ ...params, locale: "xx-unused", slugs: ["lookup-used"] })).toEqual(new Set());
	});

	it("returns an empty set for no slugs without querying", async () => {
		const query = vi.fn();
		const counting = { query } as unknown as Pool;
		const empty = createContentLookup({ pool: counting, schema: schemaName });
		expect(await empty.slugsInUse({ collection: "post", locale: "ko", slugs: [] })).toEqual(new Set());
		expect(query).not.toHaveBeenCalled();
	});
});
