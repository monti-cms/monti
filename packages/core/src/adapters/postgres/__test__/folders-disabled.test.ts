import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testConfig } from "../../../../test/site";
import { moveToFolder, seedEntry, seedSave } from "../../../core/store/__test__/seed";
import { createSite } from "../../../site";
import { createContentStore, migrateContentStore } from "../content-store";
import { closeGlobalPool, createIsolatedTestPool, dropIsolatedTestPool } from "./test-database";

// A site can turn folders off after folders exist (`folders: false` on a collection that had them). The rows stay in the database; the store must refuse to
// work with them, except moving things out of them.

const config = testConfig as unknown as { collections: Record<string, Record<string, unknown>> };
const probe = createSite(testConfig);
const collection = probe.COLLECTIONS.find((name) => !probe.foldersEnabled(name));

const siteWithFolders = createSite({
	...testConfig,
	collections: {
		...config.collections,
		...(collection ? { [collection]: { ...config.collections[collection], folders: true } } : {}),
	},
} as typeof testConfig);

describe.skipIf(!collection)("Folders turned off after the fact", () => {
	let pool: Awaited<ReturnType<typeof createIsolatedTestPool>>["pool"];
	let schemaName: string;
	let on: ReturnType<typeof createContentStore>;
	let off: ReturnType<typeof createContentStore>;

	beforeAll(async () => {
		({ pool, schemaName } = await createIsolatedTestPool());
		await migrateContentStore(pool, { site: probe, schema: schemaName });
		on = createContentStore(pool, { site: siteWithFolders, schema: schemaName });
		off = createContentStore(pool, { site: probe, schema: schemaName });
	});

	afterAll(async () => {
		await dropIsolatedTestPool(pool, schemaName);
	});

	it("rejects changing, deleting and reading the contents of a folder in a collection without folders", async () => {
		const folder = await on.createFolder({ collection: collection as string, parentId: null, name: "Left over" });
		await expect(off.updateFolder({ id: folder.id, name: "Renamed" })).rejects.toMatchObject({ code: "invalid_input" });
		await expect(off.deleteFolder({ id: folder.id })).rejects.toMatchObject({ code: "invalid_input" });
		await expect(off.getFolderContents({ id: folder.id })).rejects.toMatchObject({ code: "invalid_input" });
		// The folder is untouched.
		expect((await on.listFolders({ collection: collection as string })).map((f) => f.name)).toEqual(["Left over"]);
	}, 30_000);

	it("rejects saving an entry into such a folder, but lets it leave the folder", async () => {
		const folder = await on.createFolder({ collection: collection as string, parentId: null, name: "Old home" });
		const entry = await seedEntry(on, {
			collection: collection as string,
			slug: null,
			metadata: { title: "T" },
			folderId: folder.id,
		});
		expect(entry.folderId).toBe(folder.id);

		await expect(
			moveToFolder(off, { entryId: entry.id, folderId: folder.id, expectedVersion: entry.version }),
		).rejects.toMatchObject({ code: "invalid_input" });

		const left = await seedSave(off, entry.id, {
			metadata: { title: "T2" },
			folderId: null,
			expectedVersion: entry.version,
		});
		expect(left.folderId).toBeNull();
		expect(left.version).toBeGreaterThan(entry.version);
	}, 30_000);

	afterAll(closeGlobalPool);
});
