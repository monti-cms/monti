import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { contentCollection, recordRelationField, requiredMetadata, secondLocale } from "../../../../test/any-site";
import type { Collection } from "../../../core/collections";
import { imageWarningsForSnapshot, prepareSnapshot } from "../../../core/snapshot";
import { storedFields } from "../../../schema/derive";
import { createBulkService } from "../../../services/bulk-service";
import { createContentService } from "../../../services/content-service";
import { type ContentStore, createContentStore, type Entry, migrateContentStore } from "../content-store";
import { duplicateDraft, publishDraft, seedEntry, seedSave } from "./seed";
import { closeGlobalPool, createIsolatedTestPool, dropIsolatedTestPool } from "./test-database";

/**
 * A site removes a field, or an option of a select field, while entries still hold values for it. Those values stay in the stored metadata
 * on every write path and never block saving or publishing; publishing only warns about them. Uses real PostgreSQL and the production write paths.
 * The schema is not edited: a key the current schema does not know and an option the select does not list are the same situation.
 */

/** A key no config has a field for: what is left behind when a field is removed. */
const ORPHAN = "removedField";
const ORPHAN_LIST = "removedList";
/** A select value no option has: what is left behind when an option is removed. */
const UNKNOWN_OPTION = "removed-option";
const selectField = storedFields(contentCollection).find(({ field, when }) => !when && field.kind === "select");
/** Relation field a bulk operation can change (several values, to an item collection). */
const manyRelation = (() => {
	for (const { name, field, when } of storedFields(contentCollection)) {
		if (!when && field.kind === "relation" && field.many && recordRelationField(contentCollection))
			return { name, to: field.to };
	}
	return undefined;
})();

describe("values of removed fields and options", () => {
	let pool: Pool;
	let schemaName: string;
	let store: ContentStore;
	let service: ReturnType<typeof createContentService<Entry>>;
	let sequence = 0;
	const unique = (prefix: string) => `${prefix}-${++sequence}`;
	const targets = new Map<Collection, string>();

	beforeAll(async () => {
		const isolated = await createIsolatedTestPool();
		pool = isolated.pool;
		schemaName = isolated.schemaName;
		await migrateContentStore(pool, { schema: schemaName });
		store = createContentStore(pool, { schema: schemaName });
		service = createContentService<Entry>(store);
	});

	afterAll(async () => {
		if (pool && schemaName) await dropIsolatedTestPool(pool, schemaName);
		await closeGlobalPool();
	});

	const relationTarget = async (to: Collection): Promise<string> => {
		const known = targets.get(to);
		if (known) return known;
		const draft = await service.createDraft({
			collection: to,
			slug: unique(to),
			metadata: await requiredMetadata(to, unique(`target ${to}`), relationTarget),
			mdx: "Body",
		});
		const id = (
			draft.status === "published" ? draft : await publishDraft(store, { id: draft.id, expectedVersion: draft.version })
		).id;
		targets.set(to, id);
		return id;
	};

	/** Metadata a post can publish with, plus what the removed field and option left behind. */
	const staleMetadata = async (title: string) => ({
		...(await requiredMetadata(contentCollection, title, relationTarget)),
		[ORPHAN]: "left behind",
		[ORPHAN_LIST]: ["a", "b"],
		...(selectField ? { [selectField.name]: UNKNOWN_OPTION } : {}),
	});

	/** A draft the way an earlier schema saved it: the stored values are written as they are, past validation. */
	const staleDraft = async (title = "Stale") =>
		seedEntry(store, {
			collection: contentCollection,
			slug: unique("stale"),
			metadata: await staleMetadata(title),
			mdx: "Body",
		});

	it("rejects a new unknown key on create and on save: a typo is not a removed field", async () => {
		await expect(
			service.createDraft({
				collection: contentCollection,
				slug: unique("create"),
				metadata: { ...(await requiredMetadata(contentCollection, "Create", relationTarget)), titel: "typo" },
				mdx: "Body",
			} as never),
		).rejects.toMatchObject({ code: "invalid_metadata_key" });

		const draft = await staleDraft("Typo");
		await expect(
			service.saveDraft(draft.id, {
				collection: contentCollection,
				slug: draft.workingSlug,
				metadata: { ...draft.working.metadata, titel: "typo" },
				mdx: "Body",
				expectedVersion: draft.version,
			} as never),
		).rejects.toMatchObject({ code: "invalid_metadata_key" });
	});

	it("keeps the value of a removed field when saving", async () => {
		const draft = await staleDraft("Save");
		// An API client that sends the stored metadata back, edited elsewhere, loses nothing.
		const saved = await service.saveDraft(draft.id, {
			collection: contentCollection,
			slug: draft.workingSlug,
			metadata: { ...draft.working.metadata, title: "Renamed" },
			mdx: "Body",
			expectedVersion: draft.version,
		} as never);
		expect(saved.working.metadata).toMatchObject({
			title: "Renamed",
			[ORPHAN]: "left behind",
			[ORPHAN_LIST]: ["a", "b"],
		});
	});

	it.skipIf(!selectField)("keeps a select value that is no longer an option instead of the default", async () => {
		const name = selectField?.name ?? "";
		const draft = await staleDraft("Select");
		expect(draft.working.metadata[name]).toBe(UNKNOWN_OPTION);
		const saved = await service.saveDraft(draft.id, {
			collection: contentCollection,
			slug: draft.workingSlug,
			metadata: draft.working.metadata,
			mdx: "Body changed",
			expectedVersion: draft.version,
		} as never);
		expect(saved.working.metadata[name]).toBe(UNKNOWN_OPTION);
	});

	it("publishes an entry holding removed values, keeps them in the published version and warns", async () => {
		const draft = await staleDraft("Publish");
		const published = await publishDraft(store, { id: draft.id, expectedVersion: draft.version });
		expect(published.status).toBe("published");
		expect(published.published?.metadata[ORPHAN]).toBe("left behind");
		expect(published.published?.metadata[ORPHAN_LIST]).toEqual(["a", "b"]);
		if (selectField) expect(published.published?.metadata[selectField.name]).toBe(UNKNOWN_OPTION);

		const working = await store.getWorking({ entryId: draft.id });
		const warnings = await imageWarningsForSnapshot(
			await prepareSnapshot(
				{ collection: working.collection, slug: working.slug, metadata: working.metadata, mdx: working.mdx } as never,
				{ previousMetadata: working.metadata },
			),
			{ getMediaAsset: async () => null },
		);
		expect(warnings).toContainEqual(expect.objectContaining({ code: "orphaned_metadata_key", path: ORPHAN }));
		expect(warnings).toContainEqual(expect.objectContaining({ code: "orphaned_metadata_key", path: ORPHAN_LIST }));
		if (selectField) {
			expect(warnings).toContainEqual(
				expect.objectContaining({ code: "unknown_select_value", path: selectField.name, message: UNKNOWN_OPTION }),
			);
		}
	});

	it("publishes in bulk an entry holding removed values", async () => {
		const draft = await staleDraft("Bulk publish");
		const { results } = await createBulkService(store).run({
			op: "publish",
			items: [{ id: draft.id, expectedVersion: draft.version }],
		});
		expect(results).toEqual([{ id: draft.id, ok: true, version: draft.version + 1 }]);
		const after = await store.getEntry(draft.id);
		expect(after.status).toBe("published");
		expect(after.working.metadata[ORPHAN]).toBe("left behind");
	});

	it.skipIf(!manyRelation)("keeps removed values when a bulk operation saves the metadata", async () => {
		if (!manyRelation) return;
		const draft = await staleDraft("Bulk relation");
		const tag = await relationTarget(manyRelation.to as Collection);
		const { results } = await createBulkService(store).run({
			op: "relation.add",
			field: manyRelation.name,
			items: [{ id: draft.id, expectedVersion: draft.version }],
			ids: [tag],
		});
		expect(results).toEqual([{ id: draft.id, ok: true, version: draft.version + 1 }]);
		const after = await store.getEntry(draft.id);
		expect(after.working.metadata[manyRelation.name]).toContain(tag);
		expect(after.working.metadata[ORPHAN]).toBe("left behind");
		expect(after.working.metadata[ORPHAN_LIST]).toEqual(["a", "b"]);
	});

	it("keeps removed values in a duplicate", async () => {
		const draft = await staleDraft("Duplicate");
		const copy = await duplicateDraft(store, { id: draft.id });
		expect(copy.working.metadata[ORPHAN]).toBe("left behind");
		expect(copy.working.metadata[ORPHAN_LIST]).toEqual(["a", "b"]);
	});

	it.skipIf(!secondLocale)(
		"lets a translation keep a removed value it already holds, and rejects a new one",
		async () => {
			const source = await service.createDraft({
				collection: contentCollection,
				slug: unique("translated"),
				metadata: await requiredMetadata(contentCollection, "Source", relationTarget),
				mdx: "Body",
			});
			const created = await service.createTranslation({ sourceId: source.id, locale: secondLocale ?? "" });
			// The translation was saved before the field was removed.
			const translation = await seedSave(store, created.id, {
				expectedVersion: created.version,
				metadata: { title: "Translated", [ORPHAN]: "left behind" },
				mdx: "Body",
			});
			const input = (metadata: Record<string, unknown>) =>
				({
					collection: contentCollection,
					slug: source.workingSlug,
					metadata,
					mdx: "Body",
					expectedVersion: translation.version,
				}) as never;
			const saved = await service.saveDraft(translation.id, input({ title: "Retitled", [ORPHAN]: "left behind" }));
			expect(saved.working.metadata).toMatchObject({ title: "Retitled", [ORPHAN]: "left behind" });
			await expect(
				service.saveDraft(translation.id, {
					...(input({ title: "T", titel: "typo" }) as object),
					expectedVersion: saved.version,
				} as never),
			).rejects.toMatchObject({ code: "invalid_metadata_key" });
		},
	);
});
