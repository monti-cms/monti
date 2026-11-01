import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { contentCollection, requiredMetadata, secondLocale } from "../../../test/any-site";
import { paragraphsFormat } from "../../../test/paragraphs-format";
import { testSite } from "../../../test/site";
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

/** Rules of the content service and the store it runs on, against a real store (the store holds the site, so a site variant gets its own store). */
describe("content service rules", () => {
	let pool: Pool;
	let schemaName: string;
	let store: ContentStore;
	let sequence = 0;
	const formats = async () => createFormatRegistry([paragraphsFormat]);
	const serviceFor = (site: typeof testSite) =>
		createContentService(createContentStore(pool, { site, schema: schemaName }), { site, formats });

	const createPost = async (service: ReturnType<typeof serviceFor>) =>
		(
			await service.createDraft({
				collection: contentCollection,
				slug: `rules-${++sequence}`,
				metadata: await requiredMetadata(contentCollection, `Rules ${sequence}`, async () => {
					throw new Error("service-rules: the content collection needs a relation target");
				}).catch(() => ({ title: `Rules ${sequence}` })),
				format: "paragraphs",
				body: "Body",
			})
		).entry;

	beforeAll(async () => {
		({ pool, schemaName } = await createIsolatedTestPool());
		await migrateContentStore(pool, { site: testSite, schema: schemaName });
		store = createContentStore(pool, { site: testSite, schema: schemaName });
	});

	afterAll(async () => {
		if (pool && schemaName) await dropIsolatedTestPool(pool, schemaName);
		await closeGlobalPool();
	});

	it("TRASH-T7 refuses to duplicate a trashed entry, and allows it once restored", async () => {
		const service = serviceFor(testSite);
		const entry = await createPost(service);
		const trashed = await store.trashEntry({ id: entry.id, expectedVersion: entry.version });
		await expect(service.duplicate({ id: entry.id })).rejects.toMatchObject({
			code: "invalid_status",
			notice: { key: "entry.duplicate.trashed" },
		});

		await store.restoreEntry({ id: entry.id, expectedVersion: trashed.version });
		const copy = await service.duplicate({ id: entry.id });
		expect(copy.entry.id).not.toBe(entry.id);
	});

	it.skipIf(!secondLocale)(
		"TRANS-N1 refuses to translate an archived entry, and allows it once unarchived",
		async () => {
			const service = serviceFor(testSite);
			const source = await createPost(service);
			const archived = await store.archiveEntry({ id: source.id, expectedVersion: source.version });
			await expect(
				service.createTranslation({ sourceId: source.id, locale: secondLocale as string }),
			).rejects.toMatchObject({
				code: "invalid_status",
			});

			await store.unarchiveEntry({ id: source.id, expectedVersion: archived.version });
			const translation = await service.createTranslation({ sourceId: source.id, locale: secondLocale as string });
			expect(translation.entry.locale).toBe(secondLocale);
		},
		30_000,
	);
});
