import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { docOf } from "../../../../test/stored-content";
import { fakeCms } from "../../../cms";
import type { ContentStore, Entry } from "../../../core/store";
import { publishDraft } from "../../../core/store/__test__/seed";
import { defineCollection, defineConfig, fields } from "../../../index";
import { createContentService } from "../../../services/content-service";
import { createSite } from "../../../site";
import { createContentStore, migrateContentStore } from "../content-store";
import { closeGlobalPool, createIsolatedTestPool, dropIsolatedTestPool } from "./test-database";

/**
 * The title field is named by its role (`role: "title"`), not by the key `title`. A site whose articles keep the title in `headline` and whose topics keep it in `name`
 * (two different keys, so a query across collections has to tell them apart) works end to end: create, list, sort, search, relations, the public read.
 */
const config = defineConfig({
	collections: {
		article: defineCollection({
			label: "Article",
			kind: "document",
			path: "/articles/:slug",
			fields: {
				headline: fields.text({ label: "Headline", role: "title", required: true, max: 200, localized: true }),
				slug: fields.slug({ label: "Slug", from: "headline", required: true, localized: "inherit" }),
				topicIds: fields.relation({ label: "Topics", to: "topic", many: true }),
			},
		}),
		topic: defineCollection({
			label: "Topic",
			kind: "item",
			fields: {
				name: fields.text({ label: "Name", role: "title", required: true, localized: true }),
				slug: fields.slug({ label: "Slug", from: "name", required: true }),
			},
		}),
	},
	locales: [
		{ code: "en", name: "English" },
		{ code: "ko", name: "한국어" },
	],
	defaultLocale: "en",
});

const makeCms = (store: ContentStore) => fakeCms({ config, store });

describe("a collection whose title field is not named title", () => {
	const site = createSite(config);
	let pool: Pool;
	let schemaName: string;
	let store: ContentStore;
	let service: ReturnType<typeof createContentService<Entry>>;
	let cms: ReturnType<typeof makeCms>;

	beforeAll(async () => {
		const isolated = await createIsolatedTestPool();
		pool = isolated.pool;
		schemaName = isolated.schemaName;
		await migrateContentStore(pool, { site, schema: schemaName });
		store = createContentStore(pool, { site, schema: schemaName });
		service = createContentService<Entry>(store, { site });
		cms = makeCms(store);
	});

	afterAll(async () => {
		if (pool && schemaName) await dropIsolatedTestPool(pool, schemaName);
		await closeGlobalPool();
	});

	const article = async (headline: string, extra: Record<string, unknown> = {}) =>
		service.createDraft({
			collection: "article",
			slug: site.slugFromValues("article", { headline }),
			metadata: { headline, ...extra },
			doc: docOf(`Body of ${headline}`),
		} as never);
	const publish = async (entry: Entry) => publishDraft(site, store, { id: entry.id, expectedVersion: entry.version });
	const topic = (name: string, translations?: Record<string, { name: string }>) =>
		service.createDraft({
			collection: "topic",
			slug: null,
			metadata: { name, ...(translations ? { translations } : {}) },
			doc: docOf(""),
		} as never);

	it("answers the title field as the title of the site's collections", () => {
		expect(site.titleField("article").name).toBe("headline");
		expect(site.titleField("topic").name).toBe("name");
		expect(site.titleOfValues("article", { headline: "A", title: "ignored" })).toBe("A");
	});

	it("makes the address from the title field and lists, sorts and searches by it", async () => {
		const zebra = await article("Zebra crossing");
		const apple = await article("Apple pie");
		const mango = await article("Mango tree");
		expect([zebra, apple, mango].map((entry) => entry.workingSlug)).toEqual([
			"zebra-crossing",
			"apple-pie",
			"mango-tree",
		]);

		const sorted = await store.listEntries({
			collection: "article",
			sort: { field: "title", direction: "asc" },
			pageSize: 25,
		});
		expect(sorted.items.map((item) => item.title)).toEqual(["Apple pie", "Mango tree", "Zebra crossing"]);
		const descending = await store.listEntries({
			collection: "article",
			sort: { field: "title", direction: "desc" },
			pageSize: 25,
		});
		expect(descending.items.map((item) => item.title)).toEqual(["Zebra crossing", "Mango tree", "Apple pie"]);

		const searched = await store.listEntries({ collection: "article", search: "MANGO", pageSize: 25 });
		expect(searched.items.map((item) => item.title)).toEqual(["Mango tree"]);
		const filtered = await store.listEntries({ collection: "article", titleContains: "pie", pageSize: 25 });
		expect(filtered.items.map((item) => item.title)).toEqual(["Apple pie"]);

		const hits = await store.searchEntries({ collection: "article", query: "tree" });
		expect(hits).toEqual([expect.objectContaining({ title: "Mango tree", slug: "mango-tree" })]);
		const untitled = await store.searchEntries({ collection: "article", query: "zebra" });
		expect(untitled.map((hit) => hit.title)).toEqual(["Zebra crossing"]);
	});

	it("shows the title of a related entry and of the translation group, whatever the key of its collection", async () => {
		const music = await topic("Music");
		const post = await article("Related post", { topicIds: [music.id] });

		const list = await store.listEntries({ collection: "article", search: "Related", pageSize: 25 });
		expect(list.items[0]?.relations.topicIds).toEqual([{ id: music.id, title: "Music" }]);

		const incoming = await store.getIncomingReferences({ targetId: music.id });
		expect(incoming).toEqual([expect.objectContaining({ sourceId: post.id, sourceTitle: "Related post" })]);

		const group = await store.getTranslationGroup({ entryId: post.id });
		expect(group.members.map((member) => member.title)).toEqual(["Related post"]);

		await expect(store.trashEntry({ id: music.id, expectedVersion: music.version })).rejects.toMatchObject({
			code: "in_use",
			details: { usages: [expect.objectContaining({ entryId: post.id, title: "Related post" })] },
		});
	});

	it("reads the title on the public side and sorts the public list by it", async () => {
		const beta = await publish(await article("Public beta"));
		const alpha = await publish(await article("Public alpha"));

		const page = await store.listPublishedPage({
			collection: "article",
			sort: "title",
			order: "asc",
			pageSize: 100,
		});
		const names = page.items.map((item) => item.metadata.headline);
		expect(names.indexOf("Public alpha")).toBeLessThan(names.indexOf("Public beta"));

		const read = await cms.read.listEntries({ collection: "article", sort: "title", order: "asc", pageSize: 100 });
		const titles = read.items.map((item) => item.title);
		expect(titles).toContain("Public alpha");
		expect(titles.indexOf("Public alpha")).toBeLessThan(titles.indexOf("Public beta"));
		expect(read.items.find((item) => item.id === beta.id)?.metadata).toMatchObject({ headline: "Public beta" });

		const one = await cms.read.getEntry({ collection: "article", slug: alpha.publishedSlug as string });
		expect(one.status).toBe("found");
		if (one.status === "found") expect(one.entry.title).toBe("Public alpha");
	});

	it("sorts a record collection by the name of the display language", async () => {
		await topic("Cat", { ko: { name: "나비" } });
		await topic("Dog", { ko: { name: "가을" } });
		await topic("Ant", { ko: { name: "다람쥐" } });

		const english = await store.listPublishedPage({ collection: "topic", sort: "title", order: "asc", pageSize: 100 });
		expect(
			english.items.map((item) => item.metadata.name).filter((name) => ["Ant", "Cat", "Dog"].includes(String(name))),
		).toEqual(["Ant", "Cat", "Dog"]);

		const korean = await store.listPublishedPage({
			collection: "topic",
			sort: "title",
			order: "asc",
			titleLocale: "ko",
			pageSize: 100,
		});
		expect(
			korean.items.map((item) => item.metadata.name).filter((name) => ["Ant", "Cat", "Dog"].includes(String(name))),
		).toEqual(["Dog", "Cat", "Ant"]);

		const read = await cms.read.listEntries({
			collection: "topic",
			locale: "ko",
			sort: "title",
			order: "asc",
			pageSize: 100,
		});
		expect(
			read.items.map((item) => item.title).filter((name) => ["나비", "가을", "다람쥐"].includes(String(name))),
		).toEqual(["가을", "나비", "다람쥐"]);
	});

	it("duplicates an entry with a new title written to the title field", async () => {
		const source = await article("Original");
		const copy = await service.duplicate({ id: source.id, title: "Original (copy)" });
		expect(copy.working.metadata).toMatchObject({ headline: "Original (copy)" });
		expect(copy.working.metadata).not.toHaveProperty("title");
	});
});
