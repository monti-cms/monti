import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { contentCollection, recordCollection, requiredMetadata } from "../../../test/any-site";
import { testSite } from "../../../test/site";
import type { Collection } from "../../core/collections";
import type { ContentStore } from "../../core/store";
import { paragraphsFormat } from "../../format/__test__/paragraphs-format";
import { createFormatRegistry } from "../../format/registry";
import {
	closeGlobalPool,
	createContentStore,
	createIsolatedTestPool,
	dropIsolatedTestPool,
	migrateContentStore,
} from "../../testing";
import { createBulkService } from "../bulk-service";
import { createContentService } from "../content-service";

/** Bulk changes against a real store: a bulk relation or folder change is a save, so the store's rules and the item collection's publish-on-save apply. */

/** An item collection with a multi-value relation field, if the config has one. */
const relationItem = (() => {
	for (const collection of testSite.COLLECTIONS) {
		if (!testSite.isItemCollection(collection)) continue;
		const stored = testSite
			.storedFields(collection)
			.find(({ field }) => field.kind === "relation" && field.many === true);
		if (stored && stored.field.kind === "relation")
			return { collection, field: stored.name, to: stored.field.to as Collection };
	}
	return undefined;
})();

describe("bulk operations on a real store", () => {
	let pool: Pool;
	let schemaName: string;
	let store: ContentStore;
	let service: ReturnType<typeof createContentService>;
	let bulk: ReturnType<typeof createBulkService>;
	let sequence = 0;
	const unique = (prefix: string) => `${prefix}-${++sequence}`;
	const options = () => ({ site: testSite, formats: async () => createFormatRegistry([paragraphsFormat]) });

	/** An entry of `to`, created through the service (items publish with the save). */
	const targetOf = async (to: Collection): Promise<string> => {
		const metadata = await requiredMetadata(to, unique(`target ${to}`), targetOf);
		const created = await service.createDraft({
			collection: to,
			slug: testSite.isItemCollection(to) ? null : unique(to),
			metadata,
			format: "paragraphs",
			body: "Body",
		});
		return created.entry.id;
	};

	beforeAll(async () => {
		({ pool, schemaName } = await createIsolatedTestPool());
		await migrateContentStore(pool, { site: testSite, schema: schemaName });
		store = createContentStore(pool, { site: testSite, schema: schemaName });
		service = createContentService(store, options());
		bulk = createBulkService(store as never, options());
	});

	afterAll(async () => {
		if (pool && schemaName) await dropIsolatedTestPool(pool, schemaName);
		await closeGlobalPool();
	});

	it.skipIf(!relationItem)(
		"keeps an item published and makes a bulk relation change public with the save",
		async () => {
			const { collection, field, to } = relationItem as NonNullable<typeof relationItem>;
			const created = await service.createDraft({
				collection,
				slug: null,
				metadata: await requiredMetadata(collection, unique("bulk relation"), targetOf),
				format: "paragraphs",
				body: "",
			});
			expect(created.entry.status).toBe("published");
			const target = await targetOf(to);

			const { results } = await bulk.run({
				op: "relation.add",
				field,
				ids: [target],
				items: [{ id: created.entry.id, expectedVersion: created.entry.version }],
			});
			expect(results).toEqual([expect.objectContaining({ id: created.entry.id, ok: true })]);

			const after = await store.getEntry(created.entry.id);
			expect(after.status).toBe("published");
			expect(after.working.metadata[field]).toContain(target);
			expect(after.published?.metadata[field]).toContain(target);
			expect(after.version).toBeGreaterThan(created.entry.version);
		},
		30_000,
	);

	it("answers a bulk folder.move into a collection without folders with invalid_input per item", async () => {
		if (testSite.foldersEnabled(recordCollection)) return;
		const record = await service.createDraft({
			collection: recordCollection,
			slug: null,
			metadata: await requiredMetadata(recordCollection, unique("bulk folder"), targetOf),
			format: "paragraphs",
			body: "",
		});
		const folder = await store.createFolder({
			collection: contentCollection,
			parentId: null,
			name: unique("Elsewhere"),
		});

		const { results } = await bulk.run({
			op: "folder.move",
			folderId: folder.id,
			items: [{ id: record.entry.id, expectedVersion: record.entry.version }],
		});
		expect(results).toEqual([expect.objectContaining({ id: record.entry.id, ok: false, error: "invalid_input" })]);
		expect((await store.getEntry(record.entry.id)).folderId).toBeNull();
	}, 30_000);
});
