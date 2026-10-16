import { describe, expect, it } from "vitest";
import { ConfigError, type ConfigIssue, defineCollection, definePlugin, defineSite, fields } from "../..";
import type { Cms } from "../../cms";
import { fakeCms } from "../../cms/fake-cms";
import type { SchemaTypes } from "../types";
import { blogSchema, cloneSchema, type EditableSchema } from "./fixture";

/** The issues a config is rejected with. */
const issuesOf = (run: () => unknown): ConfigIssue[] => {
	try {
		run();
	} catch (error) {
		if (error instanceof ConfigError) return [...error.issues];
		throw error;
	}
	return [];
};

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
		expect(issuesOf(() => defineSite({ schema: fileSchema(), collections: { tag: note } }))).toEqual([
			expect.objectContaining({ path: "collections.tag", code: "set-twice" }),
		]);
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
		expect(
			issuesOf(() => defineSite({ schema: fileSchema(), locales: [{ code: "en", name: "English" }] as never })),
		).toEqual([expect.objectContaining({ path: "locales", code: "set-twice" })]);
		expect(issuesOf(() => defineSite({ schema: fileSchema(), defaultLocale: "en" as never }))).toEqual([
			expect.objectContaining({ path: "defaultLocale", code: "set-twice" }),
		]);
	});

	it("rejects an invalid schema with the path of the value, and a relation to a collection that does not exist", () => {
		const broken = cloneSchema();
		broken.collections.post.fields.title.kind = "date";
		expect(issuesOf(() => defineSite({ schema: fileSchema(broken) }))).toContainEqual(
			expect.objectContaining({ path: "collections.post.fields.title.kind" }),
		);
		const dangling = cloneSchema();
		dangling.collections.post.fields.categoryId.to = "nowhere";
		expect(issuesOf(() => defineSite({ schema: fileSchema(dangling) }))).toEqual([
			expect.objectContaining({ path: "collections.post.fields.categoryId.to", code: "unknown-collection" }),
		]);
		const noTitle = cloneSchema();
		delete noTitle.collections.tag.fields.title;
		expect(issuesOf(() => defineSite({ schema: fileSchema(noTitle) }))).toContainEqual(
			expect.objectContaining({ path: "collections.tag.fields", code: "title-missing" }),
		);
	});

	it("checks what the values of the file mean: locale codes, the default locale, the time zone, select defaults", () => {
		const check = (edit: (schema: EditableSchema) => void) => {
			const schema = cloneSchema();
			edit(schema);
			return issuesOf(() => defineSite({ schema: fileSchema(schema) }));
		};
		expect(
			check((schema) => {
				schema.locales[1].code = "EN_us";
			}),
		).toContainEqual(expect.objectContaining({ path: "locales[1].code", code: "locale-code" }));
		expect(
			check((schema) => {
				schema.defaultLocale = "ja";
			}),
		).toContainEqual(expect.objectContaining({ path: "defaultLocale", code: "unknown-locale" }));
		expect(check((schema) => schema.locales.push({ code: "ko", name: "Again" }))).toContainEqual(
			expect.objectContaining({ path: "locales[2].code", code: "duplicate" }),
		);
		expect(
			check((schema) => {
				schema.timeZone = "Mars/Base";
			}),
		).toEqual([expect.objectContaining({ path: "timeZone", code: "time-zone" })]);
		expect(
			check((schema) => {
				schema.admin.path = "/api/x";
			})[0]?.path,
		).toBe("admin.path");
		expect(
			check((schema) => {
				schema.site.url = "ftp://example.com";
			})[0]?.path,
		).toBe("site.url");
		expect(
			check((schema) => {
				schema.seed.templates[0].id = "not-a-uuid";
			})[0]?.path,
		).toBe("seed.templates[0].id");
		expect(
			check((schema) => {
				schema.collections.post.fields.policy.discriminant.defaultValue = "missing";
			})[0],
		).toMatchObject({ path: "collections.post.fields.policy.discriminant.defaultValue", code: "default-not-option" });
		expect(
			check((schema) => {
				schema.collections.post.fields.policy.values.unknown = {};
			})[0],
		).toMatchObject({
			path: "collections.post.fields.policy.values.unknown",
		});
	});

	it("still checks plugin validation against the file's collections", () => {
		const strict = definePlugin({
			name: "strict",
			options: {},
			checkConfig: ({ collections }) => {
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
