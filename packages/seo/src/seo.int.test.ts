import { createMonti, defineSchema, migrateContent, type SiteEntry } from "@monti-cms/core";
import { beforeEach, describe, expect, it } from "vitest";
import { sql, testDatabase } from "../../core/src/__test__/database";
import { SEO_FIELDS, seo, seoOf } from "./index";

const db = await testDatabase();

const schema = defineSchema({
	locales: { source: "ko", list: [{ code: "ko", name: "한국어" }], prefix: "never" },
	collections: {
		post: {
			kind: "document",
			path: "/posts/:slug",
			fields: {
				title: { kind: "text", required: true },
				slug: { kind: "slug", required: true, from: "title" },
				summary: { kind: "text" },
				cover: { kind: "media", accept: "image" },
			},
		},
		tag: { kind: "item", fields: { title: { kind: "text", required: true }, slug: { kind: "slug", required: true } } },
	},
});

const site = (options: Parameters<typeof seo>[0] = {}) => createMonti({ db, schema, plugins: [seo(options)] });
const run = <Output>(monti: ReturnType<typeof site>, name: string, input: unknown = {}) =>
	monti.run(name, input, { actor: "admin" }) as Promise<Output>;

beforeEach(async () => {
	await sql`truncate entries, monti_activity, collection_admin_values cascade`.execute(db);
	await migrateContent(db, schema, []);
});

describe("the SEO plugin on a site (T84)", () => {
	it("14-5 adds its tab to every document collection, with its fields in order and its inputs named", async () => {
		const read = await run<{
			schema: typeof schema;
			pluginTabs: Record<
				string,
				{ plugin: string; tab: string; fields: { name: string; view?: string; label?: string }[] }[]
			>;
		}>(site(), "schema.read");
		expect(Object.keys(read.pluginTabs)).toEqual(["post"]);
		expect(read.pluginTabs.post[0]).toMatchObject({ plugin: "seo", tab: "SEO" });
		expect(read.pluginTabs.post[0].fields.map((field) => [field.name, field.label ?? field.view])).toEqual([
			["seoPreview", "seo.preview"],
			["seoTitle", "SEO 제목"],
			["seoDescription", "SEO 설명"],
			["seoImage", "공유 이미지"],
			["seoNoindex", "검색에서 숨기기"],
			["seoCanonical", "대표 주소"],
		]);
		const fields = read.schema.collections.post.fields as Record<string, { input?: string; inputOptions?: unknown }>;
		expect(fields.seoTitle).toMatchObject({ kind: "text", input: "seo.title", inputOptions: { limit: 60 } });
		expect(fields.seoDescription).toMatchObject({
			input: "seo.description",
			inputOptions: { limit: 160, follows: "summary" },
		});
		expect(fields.seoNoindex).toMatchObject({ kind: "select", options: ["noindex"], input: "seo.noindex" });
	});

	it("names its fields in English when asked, counts to the lengths it is given, and keeps to the collections it is given", async () => {
		const monti = site({
			language: "en",
			limits: { title: 70 },
			collections: ["post"],
			follows: { description: "lead" },
		});
		const [tab] = monti.site.pluginTabs("post");
		expect(tab.fields.find((field) => field.name === "seoTitle")?.label).toBe("SEO title");
		const fields = monti.site.schema().collections.post.fields as Record<string, { inputOptions?: unknown }>;
		expect(fields.seoTitle.inputOptions).toEqual({ limit: 70 });
		expect(fields.seoDescription.inputOptions).toEqual({ limit: 160, follows: "lead" });
	});

	it("the search title, the description and the share image are list columns, filtered by empty (T53)", async () => {
		const monti = site();
		await run(monti, "entries.create", {
			collection: "post",
			title: "With",
			slug: "with",
			values: { seoTitle: "Search" },
		});
		await run(monti, "entries.create", { collection: "post", title: "Without", slug: "without" });
		const { columns } = await run<{
			columns: { id: string; label?: string; filter: string | null; hidden: boolean }[];
		}>(monti, "list.columns", { collection: "post" });
		expect(columns.filter((column) => column.id.startsWith("seo"))).toMatchObject([
			{ id: "seoTitle", label: "SEO 제목", filter: "empty", hidden: true },
			{ id: "seoDescription", label: "SEO 설명", filter: "empty", hidden: true },
			{ id: "seoImage", label: "공유 이미지", filter: "empty", hidden: true },
		]);
		const { rows } = await run<{ rows: { title: string }[] }>(monti, "entries.query", {
			collection: "post",
			filters: [{ on: "empty", field: "seoTitle" }],
		});
		expect(rows.map((row) => row.title)).toEqual(["Without"]);
	});

	it("hiding from search is the one word noindex, or nothing", async () => {
		const monti = site();
		const made = await run<{ output: { id: string } }>(monti, "entries.create", {
			collection: "post",
			title: "Hidden",
			slug: "hidden",
			values: { seoNoindex: "noindex" },
		});
		const read = await run<{ entry: { version: number; values: Record<string, unknown> } }>(monti, "entries.get", {
			id: made.output.id,
		});
		expect(read.entry.values).toEqual({ seoNoindex: "noindex" });
		await expect(
			run(monti, "entries.save", { id: made.output.id, version: read.entry.version, values: { seoNoindex: "index" } }),
		).rejects.toMatchObject({ reason: { key: "entries.badOption" } });
	});
});

describe("seoOf, on the site's pages", () => {
	const entry = (
		values: Record<string, unknown>,
		media?: SiteEntry["media"],
	): Pick<SiteEntry, "title" | "values" | "media"> => ({
		title: "가을 산행",
		values,
		...(media ? { media } : {}),
	});
	const picture = (id: string): NonNullable<SiteEntry["media"]> => ({
		[id]: {
			id,
			kind: "image",
			name: `${id}.jpg`,
			mime: "image/jpeg",
			size: 1000,
			url: `/files/${id}.jpg`,
			width: 1200,
			height: 630,
			original: { url: `/files/${id}-original.jpg`, width: 2400, height: 1260 },
			placeholder: null,
		},
	});

	it("gives what was written", () => {
		expect(
			seoOf(
				entry({
					[SEO_FIELDS.title]: " 검색 제목 ",
					[SEO_FIELDS.description]: "검색 설명",
					[SEO_FIELDS.canonical]: "https://example.dev/first",
					[SEO_FIELDS.noindex]: "noindex",
					summary: "요약",
				}),
			),
		).toEqual({ title: "검색 제목", description: "검색 설명", canonical: "https://example.dev/first", noindex: true });
	});

	it("falls back to the entry's title, the summary and the cover, and leaves out what is empty", () => {
		expect(seoOf(entry({}))).toEqual({ title: "가을 산행", noindex: false });
		const seo = seoOf(entry({ summary: "요약", cover: { media: "c1", alt: "산" }, seoTitle: "   " }, picture("c1")));
		expect(seo).toMatchObject({ title: "가을 산행", description: "요약", image: { src: "/files/c1.jpg", alt: "산" } });
	});

	it("the share image of its own stands before the cover, and other fields are followed when the site names them", () => {
		const media = { ...picture("c1"), ...picture("s1") };
		const both = entry({ cover: { media: "c1" }, seoImage: { media: "s1" } }, media);
		expect(seoOf(both).image?.src).toBe("/files/s1.jpg");
		const other = entry({ lead: "머리글", hero: { media: "c1" } }, media);
		expect(seoOf(other, { description: "lead", image: "hero" })).toMatchObject({
			description: "머리글",
			image: { src: "/files/c1.jpg" },
		});
	});
});
