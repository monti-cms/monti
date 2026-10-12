import { describe, expect, it } from "vitest";
import { defineCollection, definePlugin, defineSite, fields } from "../..";
import type { Cms } from "../../cms";
import { fakeCms } from "../../cms/fake-cms";
import { SchemaFileError } from "../format";
import type { SchemaTypes } from "../types";
import { blogSchema, cloneSchema, type EditableSchema } from "./fixture";

/** The content of the schema as a test edits it: loosely typed, so a test can break any part of it. */
const fileSchema = (edit: EditableSchema = cloneSchema()): SchemaTypes => edit as SchemaTypes;

describe("defineSite with a schema file", () => {
	it("builds the config from the file: normalized collections, locales, default locale, time zone, site, admin and seed", () => {
		const config = defineSite({ schema: fileSchema() });
		expect(Object.keys(config.collections)).toEqual(["post", "category", "tag", "series"]);
		expect(config.collections.post).toMatchObject({ kind: "document", body: true, path: "/posts/:slug" });
		expect(config.collections.category).toMatchObject({ kind: "item", body: false });
		expect(config.locales.map((locale) => locale.code)).toEqual(["ko", "en"]);
		expect(config.defaultLocale).toBe("ko");
		expect(config.timeZone).toBe("Asia/Seoul");
		expect(config.site).toEqual(blogSchema.site);
		expect(config.admin).toEqual(blogSchema.admin);
		expect(config.seed?.templates).toHaveLength(1);
		expect(config).not.toHaveProperty("schema");
	});

	it("does not touch the file's content, and two configs from the same content share nothing", () => {
		const schema = cloneSchema();
		const before = JSON.stringify(schema);
		const a = defineSite({ schema: fileSchema(schema) });
		const b = defineSite({ schema: fileSchema(schema) });
		expect(JSON.stringify(schema)).toBe(before);
		expect(a.collections).not.toBe(b.collections);
		expect(a.collections.post).not.toBe(b.collections.post);
	});

	it("adds what needs code: plugins and settings of the code config", () => {
		const plugin = definePlugin({ name: "extra", options: {} });
		const config = defineSite({
			schema: fileSchema(),
			plugins: [plugin],
			media: { maxImageBytes: 1000 },
		});
		expect(config.plugins?.map((item) => item.name)).toEqual(["extra"]);
		expect(config.media).toEqual({ maxImageBytes: 1000 });
	});

	it("reads the admin options that hide templates and the translation UI, and code can turn them back on", () => {
		const file = cloneSchema();
		file.admin = { ...file.admin, templates: false, translations: false };
		expect(defineSite({ schema: fileSchema(file) }).admin).toMatchObject({ templates: false, translations: false });
		expect(defineSite({ schema: fileSchema(file), admin: { templates: true } }).admin?.templates).toBe(true);
	});

	it("lets code override site and admin keys one by one, and keeps the file's value for a key left undefined", () => {
		const config = defineSite({
			schema: fileSchema(),
			site: { url: "https://example.com", name: "Renamed", previewPath: undefined },
			admin: { locale: "en" },
			timeZone: "UTC",
		});
		expect(config.site).toEqual({
			name: "Renamed",
			localePrefix: "always",
			previewPath: "/preview",
			url: "https://example.com",
		});
		expect(config.admin).toEqual({ path: "/studio", messages: blogSchema.admin.messages, locale: "en" });
		expect(config.timeZone).toBe("UTC");
		// Left undefined (an environment variable that is not set), the file's value stays.
		const same = defineSite({ schema: fileSchema(), site: { url: undefined }, timeZone: undefined });
		expect(same.site).toEqual(blogSchema.site);
		expect(same.timeZone).toBe("Asia/Seoul");
	});

	it("lets code add collections next to the file's, and refuses a name in both", () => {
		const note = defineCollection({
			label: "Note",
			kind: "item",
			fields: { title: fields.text({ label: "Title" }), slug: fields.slug({ label: "Address", from: "title" }) },
		});
		const config = defineSite({ schema: fileSchema(), collections: { note } });
		expect(Object.keys(config.collections)).toEqual(["post", "category", "tag", "series", "note"]);
		expect(() => defineSite({ schema: fileSchema(), collections: { tag: note } })).toThrow(
			/collection "tag" is defined in monti\.schema\.ts and in the config/,
		);
	});

	it("appends the code's seed templates to the file's", () => {
		const config = defineSite({
			schema: fileSchema(),
			seed: {
				templates: [{ id: "00000000-0000-4000-8000-000000000002", name: "Text", body: "# Hello", format: "mdx" }],
			},
		});
		expect(config.seed?.templates?.map((template) => template.name)).toEqual(["General post", "Text"]);
	});

	it("keeps locales and the default locale in the file only", () => {
		expect(() => defineSite({ schema: fileSchema(), locales: [{ code: "en", name: "English" }] as never })).toThrow(
			/`locales` is set in the config and in monti\.schema\.ts/,
		);
		expect(() => defineSite({ schema: fileSchema(), defaultLocale: "en" as never })).toThrow(
			/`defaultLocale` is set in the config and in monti\.schema\.ts/,
		);
	});

	it("rejects an invalid schema with the path of the value, and a relation to a collection that does not exist", () => {
		const broken = cloneSchema();
		broken.collections.post.fields.title.kind = "date";
		expect(() => defineSite({ schema: fileSchema(broken) })).toThrow(SchemaFileError);
		expect(() => defineSite({ schema: fileSchema(broken) })).toThrow(/collections\.post\.fields\.title\.kind/);
		const dangling = cloneSchema();
		dangling.collections.post.fields.categoryId.to = "nowhere";
		expect(() => defineSite({ schema: fileSchema(dangling) })).toThrow(
			/post\.categoryId relates to unknown collection "nowhere"/,
		);
		const noTitle = cloneSchema();
		delete noTitle.collections.tag.fields.title;
		expect(() => defineSite({ schema: fileSchema(noTitle) })).toThrow(/tag needs a title field/);
	});

	it("still checks plugin validation against the file's collections", () => {
		const strict = definePlugin({
			name: "strict",
			options: {},
			validate: ({ collections }) => {
				if (!("post" in collections)) throw new Error("needs post");
				if (Object.hasOwn(collections, "series")) throw new Error("no series allowed");
			},
		});
		expect(() => defineSite({ schema: fileSchema(), plugins: [strict] })).toThrow(/no series allowed/);
	});
});

describe("two schema files in one process", () => {
	const otherSchema = {
		collections: {
			article: {
				label: "Article",
				kind: "document",
				path: "/blog/:slug/",
				fields: {
					title: { kind: "text", label: "Headline", required: true },
					slug: { kind: "slug", label: "Permalink", from: "title" },
				},
			},
		},
		locales: [{ code: "en", name: "English" }],
		defaultLocale: "en",
		admin: { path: "/cms" },
	};

	const metaOf = async (cms: Cms) => {
		const response = await cms.handle(new Request("http://localhost/api/monti/v1/meta"));
		expect(response.status).toBe(200);
		return (await response.json()) as { collections: string[] };
	};

	it("each instance holds the site of its own file", async () => {
		const blog = fakeCms({ config: defineSite({ schema: fileSchema() }) });
		const other = fakeCms({ config: defineSite({ schema: fileSchema(otherSchema) }) });
		expect(blog.site.COLLECTIONS).toEqual(["post", "category", "tag", "series"]);
		expect(other.site.COLLECTIONS).toEqual(["article"]);
		expect([blog.site.LOCALES, other.site.LOCALES]).toEqual([["ko", "en"], ["en"]]);
		expect([blog.site.DEFAULT_LOCALE, other.site.DEFAULT_LOCALE]).toEqual(["ko", "en"]);
		expect([blog.site.ADMIN_PATH, other.site.ADMIN_PATH]).toEqual(["/studio", "/cms"]);
		expect([blog.site.CMS_TIME_ZONE, other.site.CMS_TIME_ZONE]).toEqual(["Asia/Seoul", "UTC"]);
		expect((await metaOf(blog)).collections).toEqual(["post", "category", "tag", "series"]);
		expect((await metaOf(other)).collections).toEqual(["article"]);
		expect(blog.site.isCollection("article")).toBe(false);
		expect(other.site.isCollection("post")).toBe(false);
	});
});
