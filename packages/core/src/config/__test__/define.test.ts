import { describe, expect, it } from "vitest";
import { defineCollection, defineConfig, definePlugin, fields } from "../..";
import { pathsOverlap } from "../define";

const title = fields.text({ label: "Title" });
const slug = fields.slug({ label: "Slug", from: "title" });
const topic = defineCollection({ label: "Topic", kind: "item", fields: { title, slug }, list: { columns: [] } });
const locales = [{ code: "en", name: "English" }];

describe("defineConfig", () => {
	it("returns the config with collections normalized (kind, body)", () => {
		const config = { collections: { topic }, locales, defaultLocale: "en" } as const;
		const defined = defineConfig(config);
		expect(defined).toEqual(config);
		expect(defined.collections.topic).toMatchObject({ kind: "item", body: false });
	});

	it("still accepts the old `workflow` (publish → document, record → item)", () => {
		const fields = { title, slug };
		const oldDocument = defineCollection({ label: "Old", workflow: "publish", fields });
		const oldItem = defineCollection({ label: "OldItem", workflow: "record", fields });
		expect(oldDocument).toMatchObject({ kind: "document", body: true });
		expect(oldItem).toMatchObject({ kind: "item", body: false });
		expect("workflow" in oldDocument).toBe(false);
		const kindDocument: "document" = oldDocument.kind;
		expect(kindDocument).toBe("document");
		// `defineCollection` 없이 적은 정의(예전 이름)도 `defineConfig`가 정리한다.
		const raw = { label: "Raw", workflow: "record", fields } as unknown as typeof topic;
		expect(defineConfig({ collections: { raw }, locales, defaultLocale: "en" }).collections.raw).toMatchObject({
			kind: "item",
			body: false,
		});
		expect(() =>
			defineConfig({
				collections: { bad: { label: "Bad", fields } as unknown as typeof topic },
				locales,
				defaultLocale: "en",
			}),
		).toThrow(/needs kind/);
		expect(() => defineCollection({ label: "Both", kind: "item", workflow: "publish", fields } as never)).toThrow(
			/kind "item" and workflow "publish"/,
		);
	});

	it("rejects collection paths that can make the same URL", () => {
		expect(pathsOverlap("/posts/:slug", "/posts/:slug/")).toBe(true);
		expect(pathsOverlap("/posts/:slug", "/posts/archive-:slug")).toBe(true);
		expect(pathsOverlap("/posts/:slug", "/posts/archive")).toBe(true);
		expect(pathsOverlap("/:slug", "/about")).toBe(true);
		expect(pathsOverlap("/a-:slug", "/a-b-:slug.html")).toBe(true);
		expect(pathsOverlap("/posts/:slug", "/memos/:slug")).toBe(false);
		expect(pathsOverlap("/posts/:slug", "/posts/:slug/edit")).toBe(false);
		expect(pathsOverlap("/p-:slug", "/q-:slug")).toBe(false);
		expect(pathsOverlap("/:slug.html", "/:slug.json")).toBe(false);
		expect(pathsOverlap("/posts/:slug", "/posts/")).toBe(false);

		const page = (path: `/${string}:slug${string}`) =>
			defineCollection({ label: "Page", kind: "document", path, fields: { title, slug }, list: { columns: [] } });
		expect(() =>
			defineConfig({
				collections: { post: page("/posts/:slug"), archive: page("/posts/archive-:slug") },
				locales,
				defaultLocale: "en",
			}),
		).toThrow(/archive.path "\/posts\/archive-:slug" can make the same URL as post.path/);
		expect(() =>
			defineConfig({
				collections: { post: page("/posts/:slug"), memo: page("/memos/:slug") },
				locales,
				defaultLocale: "en",
			}),
		).not.toThrow();
	});

	it("rejects a field named like a reserved metadata key (`translations`)", () => {
		const collection = defineCollection({
			label: "Reserved",
			kind: "item",
			fields: { title, slug, translations: fields.text({ label: "Translations" }) },
		});
		expect(() => defineConfig({ collections: { collection }, locales, defaultLocale: "en" })).toThrow(
			/translations uses a reserved name/,
		);
	});

	it("rejects locale codes that are not BCP 47 shaped (they go into URLs and SQL defaults)", () => {
		for (const code of ["pt-BR", "zh-Hant", "ko"]) {
			expect(() =>
				defineConfig({ collections: { topic }, locales: [{ code, name: code }], defaultLocale: code }),
			).not.toThrow();
		}
		for (const code of ["EN", "en_US", "e'n", "english language"]) {
			expect(() =>
				defineConfig({ collections: { topic }, locales: [{ code, name: code }], defaultLocale: code }),
			).toThrow(/locale code/);
		}
	});

	it("checks the admin locale and fillFromBody.maxLength", () => {
		expect(() =>
			defineConfig({ collections: { topic }, locales, defaultLocale: "en", admin: { locale: "not a locale!" } }),
		).toThrow(/admin.locale/);
		const article = defineCollection({
			label: "Article",
			kind: "document",
			fields: { title, summary: fields.text({ label: "Summary", fillFromBody: { maxLength: 0 } }) },
		});
		expect(() => defineConfig({ collections: { article }, locales, defaultLocale: "en" })).toThrow(/maxLength/);
	});

	it("checks the admin path, locale prefix, preview locale param and site home", () => {
		const base = { collections: { topic }, locales, defaultLocale: "en" } as const;
		expect(() => defineConfig({ ...base, admin: { path: "/studio" } })).not.toThrow();
		expect(() => defineConfig({ ...base, admin: { path: "/cms/admin" } })).not.toThrow();
		for (const path of ["/", "admin", "/admin/", "/api/admin", "/a b"]) {
			expect(() => defineConfig({ ...base, admin: { path } })).toThrow(/admin.path/);
		}
		expect(() => defineConfig({ ...base, site: { localePrefix: "always" } })).not.toThrow();
		expect(() => defineConfig({ ...base, site: { localePrefix: "sometimes" as "always" } })).toThrow(/localePrefix/);
		expect(() => defineConfig({ ...base, site: { previewLocaleParam: false } })).not.toThrow();
		expect(() => defineConfig({ ...base, site: { previewLocaleParam: "lang" } })).not.toThrow();
		expect(() => defineConfig({ ...base, site: { previewLocaleParam: "a b" } })).toThrow(/previewLocaleParam/);
		expect(() => defineConfig({ ...base, site: { home: "https://example.com" } })).not.toThrow();
		expect(() => defineConfig({ ...base, site: { home: "/blog" } })).not.toThrow();
		expect(() => defineConfig({ ...base, site: { home: "//evil.example" } })).toThrow(/site.home/);
		expect(() => defineConfig({ ...base, site: { home: "javascript:alert(1)" } })).toThrow(/site.home/);
	});

	it("rejects a default locale outside the list and duplicate locales", () => {
		expect(() => defineConfig({ collections: { topic }, locales, defaultLocale: "ko" as "en" })).toThrow(
			/defaultLocale/,
		);
		expect(() =>
			defineConfig({ collections: { topic }, locales: [...locales, ...locales], defaultLocale: "en" }),
		).toThrow(/duplicate/);
	});

	it("rejects relations and backlinks to unknown or mismatched collections", () => {
		const article = defineCollection({
			label: "Article",
			kind: "document",
			fields: { title, topicId: fields.relation({ label: "Topic", to: "missing" }) },
			list: { columns: [] },
		});
		expect(() => defineConfig({ collections: { article }, locales, defaultLocale: "en" })).toThrow(
			/unknown collection/,
		);

		const series = defineCollection({
			label: "Series",
			kind: "item",
			fields: { title, articleId: fields.relation({ label: "Article", to: "article" }) },
			list: { columns: [] },
		});
		const linked = defineCollection({
			label: "Article",
			kind: "document",
			fields: { title, series: fields.backlink({ label: "Series", from: "series", via: "articleId" }) },
			list: { columns: [] },
		});
		// `via`가 여러 개 관계가 아니면 반대 방향 관계를 만들 수 없다.
		expect(() => defineConfig({ collections: { article: linked, series }, locales, defaultLocale: "en" })).toThrow(
			/many relation/,
		);
	});

	it("checks the public path pattern and site URL", () => {
		const withPath = (path: string) => ({ ...topic, path }) as typeof topic & { path: `/${string}:slug${string}` };
		expect(() =>
			defineConfig({ collections: { topic: withPath("/topics/:slug") }, locales, defaultLocale: "en" }),
		).not.toThrow();
		for (const path of ["topics/:slug", "/topics", "/:slug/:slug", "/:lang/:slug", "/t/:slug?x"]) {
			expect(() => defineConfig({ collections: { topic: withPath(path) }, locales, defaultLocale: "en" })).toThrow(
				/path/,
			);
		}
		const noSlug = defineCollection({
			label: "Note",
			kind: "document",
			path: "/notes/:slug",
			fields: { title },
			list: { columns: [] },
		});
		expect(() => defineConfig({ collections: { noSlug }, locales, defaultLocale: "en" })).toThrow(/slug field/);
		expect(() =>
			defineConfig({ collections: { topic }, locales, defaultLocale: "en", site: { url: "example.com" } }),
		).toThrow(/site.url/);
	});

	it("checks seed template ids", () => {
		const template = { id: "00000000-0000-4000-8000-000000000001", name: "Note", mdx: "" };
		const base = { collections: { topic }, locales, defaultLocale: "en" } as const;
		expect(() => defineConfig({ ...base, seed: { templates: [template] } })).not.toThrow();
		expect(() => defineConfig({ ...base, seed: { templates: [{ ...template, id: "1" }] } })).toThrow(/UUID/);
		expect(() => defineConfig({ ...base, seed: { templates: [template, { ...template, name: "Other" }] } })).toThrow(
			/duplicated/,
		);
	});

	it("checks layout tab names and view field names", () => {
		const note = (extra: { view?: string; tab?: string }) =>
			defineCollection({
				label: "Note",
				kind: "item",
				fields: {
					title: fields.text({ label: "Title" }),
					preview: fields.view({ view: extra.view ?? "search" }),
				},
				list: { columns: [] },
				layout: [{ fields: ["title", "preview"], ...(extra.tab !== undefined ? { tab: extra.tab } : {}) }],
			});
		expect(() =>
			defineConfig({ collections: { note: note({ tab: "검색" }) }, locales, defaultLocale: "en" }),
		).not.toThrow();
		expect(() => defineConfig({ collections: { note: note({ tab: " " }) }, locales, defaultLocale: "en" })).toThrow(
			/tab must be 1-20 characters/,
		);
		expect(() =>
			defineConfig({ collections: { note: note({ view: "Search" }) }, locales, defaultLocale: "en" }),
		).toThrow(/view must be a kebab-case name/);
	});

	it("requires a title text field in every collection", () => {
		const untitled = defineCollection({
			label: "Note",
			kind: "item",
			fields: { name: fields.text({ label: "Name" }) },
			list: { columns: [] },
		});
		expect(() => defineConfig({ collections: { untitled }, locales, defaultLocale: "en" })).toThrow(
			/untitled needs a "title" text field/,
		);
		const wrongKind = defineCollection({
			label: "Note",
			kind: "item",
			fields: { title: fields.select({ label: "Title", options: { a: "A" }, defaultValue: "a" }) },
			list: { columns: [] },
		});
		expect(() => defineConfig({ collections: { wrongKind }, locales, defaultLocale: "en" })).toThrow(/title/);
	});

	it("rejects a collection with more than one slug field", () => {
		const twoSlugs = defineCollection({
			label: "Page",
			kind: "document",
			fields: {
				title: fields.text({ label: "Title" }),
				slug: fields.slug({ label: "Slug", from: "title" }),
				handle: fields.slug({ label: "Handle", from: "title" }),
			},
			list: { columns: [] },
		});
		expect(() => defineConfig({ collections: { twoSlugs }, locales, defaultLocale: "en" })).toThrow(
			/twoSlugs has more than one slug field \(slug, handle\)/,
		);
	});

	it("checks list columns: system columns and stored fields are fine, anything else is an error", () => {
		const article = (columns: readonly string[]) =>
			defineCollection({
				label: "Article",
				kind: "document",
				fields: {
					title,
					permalink: fields.slug({ label: "Permalink", from: "title" }),
					format: fields.select({ label: "Format", options: { news: "News" }, defaultValue: "news" }),
					related: fields.relation({ label: "Related", to: "topic", many: true }),
					preview: fields.view({ view: "preview" }),
					kind: fields.conditional(
						fields.select({ label: "Kind", options: { video: "Video" }, defaultValue: "video" }),
						{ video: { videoUrl: fields.text({ label: "Video URL" }) } },
					),
				},
				list: { columns: columns as never },
			});
		const define = (columns: readonly string[]) =>
			defineConfig({ collections: { article: article(columns), topic }, locales, defaultLocale: "en" });

		expect(() =>
			define(["title", "permalink", "slug", "format", "related", "kind", "videoUrl", "status", "updatedAt", "folder"]),
		).not.toThrow();
		expect(() => define(["title", "nope"])).toThrow(/article\.list\.columns has unknown column "nope"/);
		// 시스템 컬럼 이름을 잘못 적은 경우도 같다.
		expect(() => define(["updated"])).toThrow(/unknown column "updated".*updatedAt/);
		expect(() => define(["title", "preview"])).toThrow(/"preview" is a view field that is not stored/);
		expect(() => define(["title", "format", "format"])).toThrow(/lists "format" twice/);
		// 주소 필드가 없으면 `slug`도 모르는 이름이다.
		const noSlug = defineCollection({
			label: "Note",
			kind: "document",
			fields: { title },
			list: { columns: ["slug" as never] },
		});
		expect(() => defineConfig({ collections: { noSlug }, locales, defaultLocale: "en" })).toThrow(
			/noSlug\.list\.columns has unknown column "slug"/,
		);
	});

	it("checks field roles: one field per role, and the field kind fits", () => {
		const article = (extra: Parameters<typeof defineCollection>[0]["fields"]) =>
			defineCollection({ label: "Article", kind: "document", fields: { title, ...extra }, list: { columns: [] } });
		const ok = article({
			excerpt: fields.text({ label: "Excerpt", role: "summary", fillFromBody: true }),
			metaTitle: fields.text({ label: "Meta title", role: "seoTitle" }),
			robots: fields.select({
				label: "Robots",
				role: "noindex",
				options: { index: "Index", noindex: "No index" },
				defaultValue: "index",
			}),
		});
		expect(() => defineConfig({ collections: { ok }, locales, defaultLocale: "en" })).not.toThrow();

		const twice = article({
			excerpt: fields.text({ label: "Excerpt", role: "summary" }),
			intro: fields.text({ label: "Intro", role: "summary" }),
		});
		expect(() => defineConfig({ collections: { twice }, locales, defaultLocale: "en" })).toThrow(
			/role "summary" on both excerpt and intro/,
		);

		// 본체는 요약 역할(`summary`)의 종류만 본다. 다른 역할(예: SEO 확장의 `noindex`)의 종류는 그 확장이 본다.
		const wrongSummary = article({
			excerpt: { ...fields.relation({ label: "E", to: "article" }), role: "summary" } as never,
		});
		expect(() => defineConfig({ collections: { article: wrongSummary }, locales, defaultLocale: "en" })).toThrow(
			/role "summary" needs a text field/,
		);
		const anyKind = article({
			hero: fields.media({ label: "Hero", role: "heroImage" }),
			robots: fields.select({ label: "Robots", role: "noindex", options: { index: "Index" }, defaultValue: "index" }),
		});
		expect(() => defineConfig({ collections: { anyKind }, locales, defaultLocale: "en" })).not.toThrow();
		const badName = article({ teaser: fields.text({ label: "Teaser", role: "not a name" }) });
		expect(() => defineConfig({ collections: { badName }, locales, defaultLocale: "en" })).toThrow(/invalid role/);
	});

	it("checks field tabs and media fields", () => {
		const article = (extra: Parameters<typeof defineCollection>[0]["fields"]) =>
			defineCollection({ label: "Article", kind: "document", fields: { title, ...extra }, list: { columns: [] } });
		const ok = article({ hero: fields.media({ label: "Hero", accept: "file", tab: "Media" }) });
		expect(() => defineConfig({ collections: { ok }, locales, defaultLocale: "en" })).not.toThrow();
		const longTab = article({ hero: fields.media({ label: "Hero", tab: "x".repeat(21) }) });
		expect(() => defineConfig({ collections: { longTab }, locales, defaultLocale: "en" })).toThrow(
			/hero.tab must be 1-20 characters/,
		);
		const badAccept = article({ hero: { ...fields.media({ label: "Hero" }), accept: "video" } as never });
		expect(() => defineConfig({ collections: { badAccept }, locales, defaultLocale: "en" })).toThrow(/accept/);
	});

	it("passes the whole config and other plugins to plugin checks", () => {
		const seen: unknown[] = [];
		const other = definePlugin({ name: "other", options: {}, contributes: { ai: { actions: {} } } });
		const watcher = definePlugin({
			name: "watcher",
			options: {},
			validate: (view) => {
				seen.push(
					view.defaultLocale,
					view.plugins.map((plugin) => plugin.name),
					view.blockDefinitions.length > 0,
				);
			},
		});
		const article = defineCollection({
			label: "Article",
			kind: "document",
			fields: { title },
			list: { columns: [] },
		});
		defineConfig({ collections: { article }, locales, defaultLocale: "en", plugins: [other, watcher] });
		expect(seen).toEqual(["en", ["other", "watcher"], true]);
	});

	it("allows fillFromBody only in collections with a body", () => {
		const note = defineCollection({
			label: "Note",
			kind: "item",
			fields: { title, summary: fields.text({ label: "Summary", fillFromBody: true }) },
			list: { columns: [] },
		});
		expect(() => defineConfig({ collections: { note }, locales, defaultLocale: "en" })).toThrow(/fillFromBody/);
	});

	it("checks that a slug is made from a text field", () => {
		const withFrom = (from: string) =>
			defineCollection({
				label: "Topic",
				kind: "item",
				fields: { title, name: fields.text({ label: "Name" }), slug: fields.slug({ label: "Slug", from }) },
				list: { columns: [] },
			});
		expect(() =>
			defineConfig({ collections: { topic: withFrom("name") }, locales, defaultLocale: "en" }),
		).not.toThrow();
		expect(() => defineConfig({ collections: { topic: withFrom("missing") }, locales, defaultLocale: "en" })).toThrow(
			/made from "missing"/,
		);
	});
});
