import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { contentCollection, requiredMetadata } from "../../../test/any-site";
import { paragraphsFormat } from "../../../test/paragraphs-format";
import { testSite } from "../../../test/site";
import type { Collection } from "../../core/collections";
import type { ContentStore } from "../../core/store";
import { createFormatRegistry } from "../../format/registry";
import {
	closeGlobalPool,
	createContentStore,
	createIsolatedTestPool,
	dropIsolatedTestPool,
	migrateContentStore,
} from "../../testing";
import { createContentService } from "../content-service";
import { ServiceError } from "../types";

/** The publish check against a real store: it finds what a publish would find, and it writes nothing. */
describe("publish check on a real store", () => {
	let pool: Pool;
	let schemaName: string;
	let store: ContentStore;
	let service: ReturnType<typeof createContentService>;
	let sequence = 0;
	const unique = (prefix: string) => `${prefix}-${++sequence}`;

	/** A published entry of `to`, for the relations a publishable draft needs. */
	const targetOf = async (to: Collection): Promise<string> => {
		const created = await service.createDraft({
			collection: to,
			slug: testSite.isItemCollection(to) ? null : unique(to),
			metadata: await requiredMetadata(to, unique(`target ${to}`), targetOf),
			format: "paragraphs",
			body: "Body",
		});
		if (created.entry.status !== "published")
			await service.publish({ id: created.entry.id, expectedVersion: created.entry.version });
		return created.entry.id;
	};

	const draft = async (body: string, withRequired = true) =>
		service.createDraft({
			collection: contentCollection,
			slug: unique("check"),
			metadata: withRequired
				? await requiredMetadata(contentCollection, unique("Check"), targetOf)
				: { title: unique("Check") },
			format: "paragraphs",
			body,
		});

	beforeAll(async () => {
		({ pool, schemaName } = await createIsolatedTestPool());
		await migrateContentStore(pool, { site: testSite, schema: schemaName });
		store = createContentStore(pool, { site: testSite, schema: schemaName });
		service = createContentService(store, {
			site: testSite,
			formats: async () => createFormatRegistry([paragraphsFormat]),
		});
	});

	afterAll(async () => {
		if (pool && schemaName) await dropIsolatedTestPool(pool, schemaName);
		await closeGlobalPool();
	});

	it("reports the issues a publish of the same draft is refused with, and changes nothing", async () => {
		const created = await draft("", false);
		const before = await store.getEntry(created.entry.id);

		const checked = await service.checkPublish({ id: created.entry.id });
		expect(checked.issues.length).toBeGreaterThan(0);

		const refused = await service
			.publish({ id: created.entry.id, expectedVersion: created.entry.version })
			.then(() => null)
			.catch((error: unknown) => error);
		expect(refused).toBeInstanceOf(ServiceError);
		expect((refused as ServiceError).issues).toEqual(checked.issues);

		const after = await store.getEntry(created.entry.id);
		expect(after.version).toBe(before.version);
		expect(after.status).toBe(before.status);
		expect(after.published).toBeUndefined();
	}, 30_000);

	it("finds no issues for a draft that publishes, and publishing it afterwards still works", async () => {
		const created = await draft("Body");
		const checked = await service.checkPublish({ id: created.entry.id });
		expect(checked.issues).toEqual([]);
		const unchanged = await store.getEntry(created.entry.id);
		expect(unchanged.status).toBe("draft");
		expect(unchanged.version).toBe(created.entry.version);

		const published = await service.publish({ id: created.entry.id, expectedVersion: created.entry.version });
		expect(published.entry.status).toBe("published");
	}, 30_000);

	it("refuses an entry that cannot be published as a publish does", async () => {
		const created = await draft("Body");
		await store.trashEntry({ id: created.entry.id, expectedVersion: created.entry.version });
		await expect(service.checkPublish({ id: created.entry.id })).rejects.toMatchObject({ code: "invalid_status" });
	}, 30_000);
});
