import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	contentCollection,
	defaultLocale,
	fillRequiredMetadata,
	recordRelationField,
	secondLocale,
} from "../../../test/any-site";
import { publishDraft, seedEntry, seedSave } from "../../adapters/postgres/__test__/seed";
import {
	closeGlobalPool,
	createIsolatedTestPool,
	dropIsolatedTestPool,
} from "../../adapters/postgres/__test__/test-database";
import { type ContentStore, createContentStore, migrateContentStore } from "../../adapters/postgres/content-store";
import { type Cms, fakeCms } from "../../cms";
import { COLLECTIONS, type Collection, isItemCollection } from "../../core/collections";
import { contentPath } from "../../core/links";
import { localizePath } from "../../core/locales";
import { recordLocalizedFields } from "../../schema/derive";
import type { CmsRead } from "../index";

const state = { admin: true };

/** The read API of an instance over the store the tests build. The instance reads through `cms.read`, as the app's pages do. */
let cms: Cms;
const getEntry: CmsRead["getEntry"] = (params) => cms.read.getEntry(params);
const getPreview: CmsRead["getPreview"] = (params) => cms.read.getPreview(params);
const getTranslations: CmsRead["getTranslations"] = (params) => cms.read.getTranslations(params);
const listEntries: CmsRead["listEntries"] = (params) => cms.read.listEntries(params);

/** Public site reading. Collection and field names are looked up from the config (it runs against two configs). */
describe("public site reading (cms.read)", () => {
	let pool: Pool;
	let schemaName: string;
	let store: ContentStore;
	const relation = recordRelationField(contentCollection);
	let relationTarget: (to: string) => Promise<string>;
	/** Saving without filling required values (a translation does not hold the common values). */
	let rawCreate: ContentStore["createEntryWithReferences"];

	beforeAll(async () => {
		const isolated = await createIsolatedTestPool();
		pool = isolated.pool;
		schemaName = isolated.schemaName;
		await migrateContentStore(pool, { schema: schemaName });
		store = createContentStore(pool, { schema: schemaName });
		const filled = fillRequiredMetadata(store);
		relationTarget = filled.relationTarget as (to: string) => Promise<string>;
		rawCreate = filled.raw.createEntryWithReferences;
		cms = fakeCms({
			store,
			verifyAdmin: async () => {
				if (!state.admin) throw new Error("unauthorized");
				return { userId: "u", accountId: "a", isAdmin: true };
			},
		});
	});

	afterAll(async () => {
		if (pool && schemaName) await dropIsolatedTestPool(pool, schemaName);
		await closeGlobalPool();
	});

	const publish = async (
		slug: string,
		metadata: Record<string, unknown> = {},
		locale?: string,
		translationOf?: string,
	) => {
		const draft = await (translationOf ? rawCreate : store.createEntryWithReferences)({
			snapshot: {
				collection: contentCollection,
				slug,
				metadata: { title: `Title ${slug}`, ...metadata },
				mdx: `Body ${slug}`,
				schemaVersion: 1,
				contentHash: `hash-${slug}-${locale ?? ""}`,
				references: [],
				issues: [],
				imageSources: [],
			} as never,
			references: [],
			locale,
			translationOf,
		});
		return publishDraft(store, { id: draft.id, expectedVersion: draft.version });
	};

	it("paginates and sorts the list in the DB, leaves out drafts, and filters by relation", async () => {
		const first = await publish("read-list-1");
		const second = await publish("read-list-2");
		await seedEntry(store, {
			collection: contentCollection,
			slug: "read-list-draft",
			metadata: { title: "Draft" },
			mdx: "x",
		});

		const page1 = await listEntries({ collection: contentCollection, pageSize: 1, sort: "publishedAt", order: "desc" });
		expect(page1.total).toBeGreaterThanOrEqual(2);
		expect(page1.items).toHaveLength(1);
		expect(page1.items[0]?.id).toBe(second.id);
		expect(page1.items[0]?.mdx).toBe("");
		const page2 = await listEntries({ collection: contentCollection, pageSize: 1, page: 2, body: true });
		expect(page2.items[0]?.id).toBe(first.id);
		expect(page2.items[0]?.mdx).toBe("Body read-list-1");
		const all = await listEntries({ collection: contentCollection, pageSize: 100 });
		expect(all.items.map((item) => item.slug)).not.toContain("read-list-draft");

		if (relation) {
			const target = await relationTarget(relation.to);
			const tagged = await publish("read-list-tagged", { [relation.name]: relation.many ? [target] : target });
			const filtered = await listEntries({ collection: contentCollection, where: { [relation.name]: target } });
			expect(filtered.items.map((item) => item.id)).toContain(tagged.id);
			await expect(
				listEntries({ collection: contentCollection, where: { title: "x" } as Record<string, string> }),
			).rejects.toMatchObject({ code: "invalid_input" });
		}
	});

	/** Item collection with per-locale names (topics, categories, etc.). */
	const localizedItemCollection = COLLECTIONS.find(
		(name) => isItemCollection(name) && recordLocalizedFields(name).includes("title"),
	);

	it.skipIf(!localizedItemCollection || !secondLocale)(
		"sorting an item collection by title sorts by that locale's name",
		async () => {
			const collection = localizedItemCollection as Collection;
			const language = secondLocale as string;
			const item = async (slug: string, title: string, translated: string) => {
				const draft = await store.createEntryWithReferences({
					snapshot: {
						collection,
						slug,
						metadata: { title, translations: { [language]: { title: translated } } },
						mdx: "",
						schemaVersion: 1,
						contentHash: `hash-${slug}`,
						references: [],
						issues: [],
						imageSources: [],
					} as never,
					references: [],
				});
				return publishDraft(store, { id: draft.id, expectedVersion: draft.version });
			};
			const first = await item("sort-item-a", "AAA sort", "ZZZ sort");
			const second = await item("sort-item-b", "BBB sort", "YYY sort");
			const order = async (locale?: string) =>
				(await listEntries({ collection, locale, sort: "title", order: "asc", pageSize: 500 })).items
					.map((entry) => entry.id)
					.filter((id) => id === first.id || id === second.id);

			expect(await order()).toEqual([first.id, second.id]);
			expect(await order(language)).toEqual([second.id, first.id]);
		},
	);

	it("one entry: resolves relations to the published targets' titles and URLs, and an old URL reports a redirect", async () => {
		const target = relation ? await relationTarget(relation.to) : undefined;
		const published = await publish(
			"read-detail",
			relation && target ? { [relation.name]: relation.many ? [target] : target } : {},
		);
		const found = await getEntry({ collection: contentCollection, slug: "read-detail" });
		expect(found.status).toBe("found");
		if (found.status !== "found") return;
		expect(found.entry).toMatchObject({
			id: published.id,
			title: "Title read-detail",
			mdx: "Body read-detail",
			fallback: false,
			path: localizePath(defaultLocale, contentPath(contentCollection, "read-detail") ?? ""),
		});
		if (relation && target) {
			expect(found.entry.relations[relation.name]).toEqual([
				expect.objectContaining({ id: target, collection: relation.to, title: expect.any(String) }),
			]);
		}

		const renamed = await seedSave(store, published.id, {
			expectedVersion: published.version,
			slug: "read-detail-renamed",
			metadata: published.working.metadata,
			mdx: published.working.mdx,
		});
		await publishDraft(store, { id: published.id, expectedVersion: renamed.version });
		const old = await getEntry({ collection: contentCollection, slug: "read-detail" });
		expect(old).toMatchObject({ status: "redirect", slug: "read-detail-renamed" });
		expect(await getEntry({ collection: contentCollection, slug: "no-such-entry" })).toEqual({ status: "not_found" });
	});

	it.skipIf(!secondLocale)(
		"translations: published locales and URLs, and falls back to the source text if there is no translation",
		async () => {
			const locale = secondLocale as string;
			const source = await publish("read-translated");
			const translated = await publish("read-translated", {}, locale, source.id);
			const members = await getTranslations({ translationGroupId: source.id });
			expect(members.map((member) => member.locale)).toEqual([defaultLocale, locale]);
			expect(members[1]?.path).toBe(localizePath(locale, contentPath(contentCollection, "read-translated") ?? ""));

			const inLocale = await getEntry({ collection: contentCollection, slug: "read-translated", locale });
			expect(inLocale).toMatchObject({ status: "found", entry: { id: translated.id, locale, fallback: false } });

			await publish("read-source-only");
			expect(await getEntry({ collection: contentCollection, slug: "read-source-only", locale })).toEqual({
				status: "not_found",
			});
			const fallback = await getEntry({
				collection: contentCollection,
				slug: "read-source-only",
				locale,
				fallback: true,
			});
			expect(fallback).toMatchObject({ status: "found", entry: { locale: defaultLocale, fallback: true } });
		},
	);

	it("preview shows the latest draft to admins only", async () => {
		const published = await publish("read-preview");
		await seedSave(store, published.id, {
			expectedVersion: published.version,
			metadata: published.working.metadata,
			mdx: "Edited draft",
			contentHash: "hash-edited",
		});
		state.admin = true;
		expect((await getPreview({ collection: contentCollection, slug: "read-preview" }))?.mdx).toBe("Edited draft");
		const published2 = await getEntry({ collection: contentCollection, slug: "read-preview" });
		expect(published2.status === "found" && published2.entry.mdx).toBe("Body read-preview");
		state.admin = false;
		expect(await getPreview({ collection: contentCollection, slug: "read-preview" })).toBeNull();
		state.admin = true;
	});

	it("leaves out the values of removed fields, in an entry, a list and a preview", async () => {
		const published = await publish("read-removed", { removedField: "left behind", removedList: ["a"] });
		const hidden = (metadata: Record<string, unknown>) => {
			expect(metadata.title).toBe("Title read-removed");
			expect(Object.keys(metadata)).not.toContain("removedField");
			expect(Object.keys(metadata)).not.toContain("removedList");
		};

		const found = await getEntry({ collection: contentCollection, slug: "read-removed" });
		if (found.status !== "found") throw new Error("not found");
		hidden(found.entry.metadata as Record<string, unknown>);
		const list = await listEntries({ collection: contentCollection, pageSize: 100 });
		const item = list.items.find((entry) => entry.id === published.id);
		hidden((item?.metadata ?? {}) as Record<string, unknown>);
		state.admin = true;
		const preview = await getPreview({ collection: contentCollection, slug: "read-removed" });
		hidden((preview?.metadata ?? {}) as Record<string, unknown>);

		// The stored version still has them.
		expect((await store.getEntry(published.id)).published?.metadata.removedField).toBe("left behind");
	});
});
