import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { contentCollection, recordCollection, requiredMetadata, secondLocale } from "../../../test/any-site";
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
import type { HookSource } from "../reactions";
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

	it("WRITE-P1 reports the issues a publish of the same draft is refused with, and changes nothing", async () => {
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
	});

	it("WRITE-P1 finds no issues for a draft that publishes, and publishing it afterwards still works", async () => {
		const created = await draft("Body");
		const checked = await service.checkPublish({ id: created.entry.id });
		expect(checked.issues).toEqual([]);
		const unchanged = await store.getEntry(created.entry.id);
		expect(unchanged.status).toBe("draft");
		expect(unchanged.version).toBe(created.entry.version);

		const published = await service.publish({ id: created.entry.id, expectedVersion: created.entry.version });
		expect(published.entry.status).toBe("published");
	});

	it("WRITE-P1 refuses an entry that cannot be published as a publish does", async () => {
		const created = await draft("Body");
		await store.trashEntry({ id: created.entry.id, expectedVersion: created.entry.version });
		await expect(service.checkPublish({ id: created.entry.id })).rejects.toMatchObject({ code: "invalid_status" });
	});

	it("WRITE-P1 reports the notices a publish of the same draft gives", async () => {
		const unpublished = await draft("Not published yet");
		const created = await draft(
			`[later](${testSite.contentPath(contentCollection, unpublished.entry.workingSlug ?? "")})`,
		);

		const checked = await service.checkPublish({ id: created.entry.id });
		expect(checked.warnings.map((warning) => warning.code)).toContain("unpublished_internal_link");

		const published = await service.publish({ id: created.entry.id, expectedVersion: created.entry.version });
		expect(checked.warnings).toEqual(published.warnings);
	});

	it("WRITE-P1 reports the issues a site's publish rule finds, as the publish is refused with them", async () => {
		const ruled = createContentService(store, {
			site: testSite,
			formats: async () => createFormatRegistry([paragraphsFormat]),
			hooks: () => [{ owner: "server", hooks: { beforePublish: () => ({ issues: [{ code: "held_back" }] }) } }],
		});
		const created = await draft("Body");

		const checked = await ruled.checkPublish({ id: created.entry.id });

		expect(checked.issues.map((issue) => issue.code)).toContain("held_back");
		const refused = await ruled
			.publish({ id: created.entry.id, expectedVersion: created.entry.version })
			.catch((error: unknown) => error);
		expect((refused as ServiceError).issues).toEqual(checked.issues);
	});
});

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

	it("WRITE-W10 refuses to duplicate a record, says why, and creates nothing", async () => {
		const service = serviceFor(testSite);
		const record = (
			await service.createDraft({
				collection: recordCollection,
				slug: `record-${++sequence}`,
				metadata: await requiredMetadata(recordCollection, `Record ${sequence}`, async () => {
					throw new Error("service-rules: the record collection needs no relation target");
				}),
				format: "paragraphs",
				body: "",
			})
		).entry;
		const count = async () => Number((await pool.query(`SELECT count(*) FROM "${schemaName}".entries`)).rows[0].count);
		const before = await count();

		await expect(service.duplicate({ id: record.id })).rejects.toMatchObject({
			code: "invalid_input",
			notice: { key: "entry.duplicate.record" },
		});
		expect(await count()).toBe(before);
	});

	it("TRASH-R1 a post comes back as a draft on restore, without the site's publish rules", async () => {
		const ruled = createContentService(store, {
			site: testSite,
			formats,
			hooks: () => [{ owner: "server", hooks: { beforePublish: () => ({ issues: [{ code: "held_back" }] }) } }],
		});
		const entry = await createPost(serviceFor(testSite));
		const trashed = await store.trashEntry({ id: entry.id, expectedVersion: entry.version });

		const restored = await ruled.restore({ id: entry.id, expectedVersion: trashed.version });

		expect(restored.entry.status).toBe("draft");
		expect(restored.warnings).toEqual([]);
	});

	it("WRITE-S8 a record restored and published again keeps the value of a field the schema no longer has", async () => {
		const service = serviceFor(testSite);
		const metadata = await requiredMetadata(recordCollection, `Record ${++sequence}`, async () => {
			throw new Error("service-rules: the record collection needs no relation target");
		});
		const created = await service.createDraft({
			collection: recordCollection,
			slug: `retired-${sequence}`,
			metadata,
			format: "paragraphs",
			body: "",
		});
		// A field removed from the schema after the value was saved: the stored value is all that is left of it.
		await pool.query(
			`UPDATE "${schemaName}".entry_bodies SET metadata = metadata || '{"retiredField": "kept"}'::jsonb WHERE entry_id = $1`,
			[created.entry.id],
		);
		const trashed = await store.trashEntry({ id: created.entry.id, expectedVersion: created.entry.version });

		const restored = await service.restore({ id: created.entry.id, expectedVersion: trashed.version });

		expect(restored.entry.status).toBe("published");
		expect(restored.entry.published?.metadata).toMatchObject({ retiredField: "kept" });
	});

	it.skipIf(!secondLocale)("WRITE-H5 the write hooks of a translation get the translation's language", async () => {
		const seen: string[] = [];
		const hooks: HookSource[] = [
			{
				owner: "server",
				hooks: {
					beforeSave: ({ operation, locale }) => {
						seen.push(`${operation} ${locale}`);
						return { issues: [] };
					},
				},
			},
		];
		const service = createContentService(store, { site: testSite, formats, hooks: () => hooks });
		const source = await createPost(serviceFor(testSite));
		const translation = (await service.createTranslation({ sourceId: source.id, locale: secondLocale as string }))
			.entry;
		seen.length = 0;

		await service.saveDraft(translation.id, {
			collection: contentCollection,
			slug: translation.workingSlug,
			metadata: { title: "Translated" },
			format: "paragraphs",
			body: "Translated body",
			expectedVersion: translation.version,
		} as never);
		await service.checkPublish({ id: translation.id });

		expect(seen).toEqual([`save ${secondLocale}`, `publish ${secondLocale}`]);
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
