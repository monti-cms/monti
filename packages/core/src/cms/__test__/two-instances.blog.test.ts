import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, expectTypeOf, it, vi } from "vitest";
import blog from "../../../test/cms.config";
import otherSiteConfig from "../../../test/other-site.config";
import { defineConfig } from "../../config/define";
import type { ContentStore, PublishedEntryRecord } from "../../core/store";
import { STORED_DOCUMENT_VERSION, type StoredDocument } from "../../doc/stored-document";
import type { CmsNode } from "../../doc/types";
import { defineMessages } from "../../i18n/define";
import { type DocumentComponentsFor, type DocumentComponentsOf, renderDocument } from "../../render";
import type { CmsAuth, CmsServerConfig, DatabaseAdapter } from "../../server/define";
import { createSite, type Site } from "../../site";
import { type Cms, createCms } from "../create-cms";
import { fakeCms } from "../fake-cms";

/**
 * Two instances with different site configs in one process: the reference blog (Korean, `/admin`, `/posts/:slug`) and the other site (English, `/studio`,
 * `/blog/:slug/`, a locale prefix for every locale), the latter with a smaller image size limit. They must share nothing: each answers from its own site.
 */

const other = defineConfig({ ...otherSiteConfig, media: { maxImageBytes: 1_000_000 } });

const NOW = new Date("2026-01-01T00:00:00.000Z");

const record = (collection: string, slug: string, locale: string, title: string): PublishedEntryRecord => ({
	id: `${collection}-${slug}-${locale}`,
	collection,
	locale,
	translationGroupId: `${collection}-${slug}`,
	slug,
	metadata: { title },
	doc: null,
	publishedAt: NOW,
	updatedAt: NOW,
});

/** A store that serves one published entry per collection, and remembers what it was asked, so a test can tell which instance read it. */
function fakeStore(tag: string, collection: string, slug: string, locales: readonly string[]) {
	const asked: string[] = [];
	const store: Partial<ContentStore> = {
		getPublishedEntryBySlug: async (params) => {
			const locale = params.locale ?? locales[0] ?? "";
			asked.push(`${tag}:get:${params.collection}:${params.slug}:${locale}`);
			return params.collection === collection && params.slug === slug
				? { status: "current", entry: record(collection, slug, locale, `${tag} ${slug}`) }
				: { status: "not_found" };
		},
		listPublishedPage: async (params) => {
			asked.push(`${tag}:list:${params.collection}:${params.locale}`);
			const items =
				params.collection === collection
					? locales.map((locale) => record(collection, slug, locale, `${tag} list`))
					: [];
			return {
				items: items.filter((item) => item.locale === params.locale),
				total: items.length,
				page: 1,
				pageSize: 20,
			};
		},
		listPublishedByGroups: async () => [],
		listPublishedTranslations: async () =>
			locales.map((locale) => ({ id: `${collection}-${slug}-${locale}`, collection, slug, locale })),
	};
	return { store, asked };
}

const fakeAuth = (): CmsAuth => ({
	basePath: "/api/cms/auth",
	handlers: { GET: async () => new Response("auth"), POST: async () => new Response("auth") },
	session: async () => ({ user: { id: "u", accountId: "u" } }),
	providers: [],
	signIn: async () => undefined,
	signOut: async () => undefined,
	isAdmin: () => true,
	devBypass: false,
	devUserId: "u",
});

/** A server config over a database adapter that records the site it was asked to build its store for. */
function stubServer(tag: string) {
	const sites: Site[] = [];
	const database = {
		name: `stub-${tag}`,
		createStore: vi.fn((options: { site: Site }) => {
			sites.push(options.site);
			return { tag } as unknown as ContentStore;
		}),
		migrate: vi.fn(async (options: { site: Site }) => {
			sites.push(options.site);
		}),
		pluginStorage: vi.fn(() => ({}) as never),
	} satisfies DatabaseAdapter;
	const server = {
		database,
		auth: { name: tag, create: () => fakeAuth() },
		secret: `secret-${tag}`,
	} satisfies CmsServerConfig;
	return { server, database, sites };
}

const metaOf = async (cms: Cms) => {
	const response = await cms.handle(new Request("http://localhost/api/cms/v1/meta"));
	expect(response.status).toBe(200);
	return (await response.json()) as {
		collections: string[];
		schemas: Record<string, unknown>;
		blocks: { name: string }[];
		limits: { mediaBytes: number };
	};
};

describe("two instances with different site configs", () => {
	const realBlog = stubServer("blog");
	const realOther = stubServer("other");
	const cmsBlog = createCms({ id: "blog", config: blog, server: realBlog.server });
	const cmsOther = createCms({ id: "other", config: other, server: realOther.server });

	it("each holds the site of its own config", () => {
		const a = cmsBlog.site;
		const b = cmsOther.site;
		expect(a).not.toBe(b);
		expect(a.config).toBe(blog);
		expect(b.config).toBe(other);
		expect(a.COLLECTIONS).toEqual(["post", "memo", "category", "tag", "collection"]);
		expect(b.COLLECTIONS).toEqual(["article", "topic", "author"]);
		expect(a.LOCALES).toEqual(["ko", "en", "ja"]);
		expect(b.LOCALES).toEqual(["en"]);
		expect([a.DEFAULT_LOCALE, b.DEFAULT_LOCALE]).toEqual(["ko", "en"]);
		expect([a.ADMIN_PATH, b.ADMIN_PATH]).toEqual(["/admin", "/studio"]);
		expect([a.adminHref("/media"), b.adminHref("/media")]).toEqual(["/admin/media", "/studio/media"]);
		expect([a.adminUrl("/login"), b.adminUrl("/login")]).toEqual(["/admin/login", "/studio/login"]);
		expect([a.SITE_NAME, b.SITE_NAME]).toEqual(["example.dev", "Example site"]);
		expect([a.SITE_HOME, b.SITE_HOME]).toEqual(["/", "https://example.org/"]);
		expect([a.CMS_TIME_ZONE, b.CMS_TIME_ZONE]).toEqual(["Asia/Seoul", "UTC"]);
		expect([a.ADMIN_LANGUAGE, b.ADMIN_LANGUAGE]).toEqual(["ko", "en"]);
		expect(a.BLOCKS.map((block) => block.name)).toContain("notice");
		expect(a.BLOCKS.map((block) => block.name)).not.toContain("quote-card");
		expect(b.BLOCKS.map((block) => block.name)).toContain("quote-card");
		expect(b.BLOCKS.map((block) => block.name)).not.toContain("notice");
		expect(a.isCollection("post")).toBe(true);
		expect(b.isCollection("post")).toBe(false);
		expect(a.isItemCollection("category")).toBe(true);
		expect(b.isItemCollection("topic")).toBe(true);
		expect([a.api.MAX_MEDIA_BYTES, b.api.MAX_MEDIA_BYTES]).toEqual([10 * 1024 * 1024, 1_000_000]);
	});

	it("hands its own site to its database adapter, once for the store and once for a migration", async () => {
		cmsBlog.store();
		cmsOther.store();
		await cmsBlog.migrate({ log: () => undefined });
		expect(realBlog.database.createStore).toHaveBeenCalledTimes(1);
		expect(realOther.database.createStore).toHaveBeenCalledTimes(1);
		expect(realBlog.database.migrate).toHaveBeenCalledTimes(1);
		expect(realOther.database.migrate).not.toHaveBeenCalled();
		expect(realBlog.sites.every((site) => site === cmsBlog.site)).toBe(true);
		expect(realOther.sites).toEqual([cmsOther.site]);
	});

	it("each /meta response lists its own collections, locales, blocks and limits", async () => {
		const a = await metaOf(cmsBlog);
		const b = await metaOf(cmsOther);
		expect(a.collections).toEqual(["post", "memo", "category", "tag", "collection"]);
		expect(b.collections).toEqual(["article", "topic", "author"]);
		expect(Object.keys(a.schemas)).toEqual(a.collections);
		expect(Object.keys(b.schemas)).toEqual(b.collections);
		expect(a.blocks.map((block) => block.name)).toContain("notice");
		expect(b.blocks.map((block) => block.name)).toContain("quote-card");
		expect(a.blocks.map((block) => block.name)).not.toContain("quote-card");
		expect([a.limits.mediaBytes, b.limits.mediaBytes]).toEqual([10 * 1024 * 1024, 1_000_000]);
	});

	it("the same holds for instances built by fakeCms over fake stores", async () => {
		const a = fakeCms({ config: blog });
		const b = fakeCms({ config: other });
		expect((await metaOf(a)).collections).toEqual(["post", "memo", "category", "tag", "collection"]);
		expect((await metaOf(b)).collections).toEqual(["article", "topic", "author"]);
		expect((await metaOf(b)).limits.mediaBytes).toBe(1_000_000);
		expect((await metaOf(a)).limits.mediaBytes).toBe(10 * 1024 * 1024);
	});

	it("the admin language of each site picks its own text", () => {
		const bundle = defineMessages("test.two-instances", {
			en: { hello: "Hello {name}" },
			ko: { hello: "안녕 {name}" },
		});
		expect(cmsBlog.site.createTranslator(bundle)("hello", { name: "A" })).toBe("안녕 A");
		expect(cmsOther.site.createTranslator(bundle)("hello", { name: "A" })).toBe("Hello A");
	});

	it("an admin message override of one site does not reach the other", () => {
		const bundle = defineMessages("test.two-instances", { en: { hello: "Hello" } });
		const overridden = createSite(
			defineConfig({
				...otherSiteConfig,
				admin: { ...otherSiteConfig.admin, messages: { "test.two-instances": { hello: "Howdy" } } },
			}),
		);
		expect(overridden.createTranslator(bundle)("hello")).toBe("Howdy");
		expect(cmsOther.site.createTranslator(bundle)("hello")).toBe("Hello");
	});
});

describe("two instances read their own stores and build their own public paths", () => {
	const blogStore = fakeStore("blog", "post", "hello", ["ko", "en"]);
	const otherStore = fakeStore("other", "article", "hello", ["en"]);
	const cmsBlog = fakeCms({ config: blog, store: blogStore.store });
	const cmsOther = fakeCms({ config: other, store: otherStore.store });

	it("getEntry goes to the instance's store and returns the path of its URL rule", async () => {
		const a = await cmsBlog.read.getEntry({ collection: "post", slug: "hello" });
		const b = await cmsOther.read.getEntry({ collection: "article", slug: "hello" });
		if (a.status !== "found" || b.status !== "found") throw new Error("expected both entries to be found");
		expect(a.entry.title).toBe("blog hello");
		expect(b.entry.title).toBe("other hello");
		expect(a.entry.path).toBe("/posts/hello");
		expect(b.entry.path).toBe("/en/blog/hello/");
		expect(blogStore.asked).toEqual(["blog:get:post:hello:ko"]);
		expect(otherStore.asked).toEqual(["other:get:article:hello:en"]);
	});

	it("the locale prefix follows each site's rule", async () => {
		const a = await cmsBlog.read.getEntry({ collection: "post", slug: "hello", locale: "en" });
		if (a.status !== "found") throw new Error("expected the entry");
		expect(a.entry.path).toBe("/en/posts/hello");
		expect((await cmsBlog.read.getTranslations({ translationGroupId: "post-hello" })).map((item) => item.path)).toEqual(
			["/posts/hello", "/en/posts/hello"],
		);
		expect(
			(await cmsOther.read.getTranslations({ translationGroupId: "article-hello" })).map((item) => item.path),
		).toEqual(["/en/blog/hello/"]);
	});

	it("listEntries builds its paths from its own site", async () => {
		const a = await cmsBlog.read.listEntries({ collection: "post" });
		const b = await cmsOther.read.listEntries({ collection: "article" });
		expect(a.items.map((item) => item.path)).toEqual(["/posts/hello"]);
		expect(b.items.map((item) => item.path)).toEqual(["/en/blog/hello/"]);
	});

	it("a collection of the other site is unknown to an instance", async () => {
		await expect(
			// @ts-expect-error `article` is not a collection of the blog config
			cmsBlog.read.listEntries({ collection: "article" }),
		).rejects.toThrow(/unknown collection "article"/);
		await expect(
			// @ts-expect-error `post` is not a collection of the other-site config
			cmsOther.read.getEntry({ collection: "post", slug: "hello" }),
		).rejects.toThrow(/unknown collection "post"/);
	});
});

describe("renderDocument renders the same stored document with each site's own blocks", () => {
	const siteBlog = createSite(blog);
	const siteOther = createSite(other);

	const paragraph = (value: string): CmsNode => ({ type: "paragraph", content: [{ type: "text", text: value }] });
	const doc = (...content: CmsNode[]): StoredDocument => ({ type: "doc", version: STORED_DOCUMENT_VERSION, content });

	const html = async (stored: StoredDocument, site: Site, components: Record<string, unknown>) => {
		const rendered = await renderDocument(stored, { site, components: components as never });
		return { markup: renderToStaticMarkup(rendered.content as ReactNode), unknown: rendered.unknown };
	};

	const Notice = ({ children }: { children?: ReactNode }) =>
		createElement("aside", { "data-block": "notice" }, children);
	const QuoteCard = ({ children }: { children?: ReactNode }) =>
		createElement("figure", { "data-block": "quote-card" }, children);
	const components = { blocks: { notice: Notice, "quote-card": QuoteCard } };

	const stored = doc(
		{ type: "notice", id: "blk00001", attrs: { level: "info" }, content: [paragraph("n")] },
		{ type: "quote-card", id: "blk00002", attrs: { author: "A" }, content: [paragraph("q")] },
	);

	it("draws the blocks the site defines and leaves the other site's as unknown content", async () => {
		const a = await html(stored, siteBlog, components);
		const b = await html(stored, siteOther, components);
		expect(a.markup).toContain('data-block="notice"');
		expect(a.markup).not.toContain('data-block="quote-card"');
		expect(a.unknown.map((node) => node.type)).toEqual(["quote-card"]);
		expect(b.markup).toContain('data-block="quote-card"');
		expect(b.markup).not.toContain('data-block="notice"');
		expect(b.unknown.map((node) => node.type)).toEqual(["notice"]);
	});

	it("applies the line effects of the site that renders", async () => {
		const effect = (name: string) => ({ name, label: name, class: `fx-${name}`, icon: "highlighter" });
		const withEffects = (name: string) =>
			createSite(
				defineConfig({
					collections: otherSiteConfig.collections,
					locales: otherSiteConfig.locales,
					defaultLocale: "en",
					codeBlock: { lineEffects: [effect(name)] },
				}),
			);
		const siteGlow = withEffects("glow");
		const siteBeam = withEffects("beam");
		const code = (name: string): StoredDocument =>
			doc({
				type: "codeBlock",
				attrs: { language: "ts", meta: "", code: `const a = 1;\n// @line ${name}\nconst b = 2;` } as never,
			});
		const render = async (site: Site, name: string) =>
			renderToStaticMarkup((await renderDocument(code(name), { site })).content as ReactNode);
		expect(siteGlow.CODE_LINE_EFFECTS.map((item) => item.name)).toContain("glow");
		expect(siteGlow.CODE_LINE_EFFECTS.map((item) => item.name)).not.toContain("beam");
		expect(siteBeam.CODE_LINE_EFFECTS.map((item) => item.name)).toContain("beam");
		expect(await render(siteGlow, "glow")).toContain("fx-glow");
		expect(await render(siteBeam, "beam")).toContain("fx-beam");
		expect(await render(siteBeam, "glow")).not.toContain("fx-glow");
	});
});

describe("a site snapshot crosses JSON and gives the same site", () => {
	it.each([
		["blog", blog],
		["other site", other],
	])("%s", (_name, config) => {
		const site = createSite(config);
		const copy = createSite(JSON.parse(JSON.stringify(site.snapshot())));
		expect(copy.COLLECTIONS).toEqual(site.COLLECTIONS);
		expect(copy.LOCALES).toEqual(site.LOCALES);
		expect(copy.DEFAULT_LOCALE).toBe(site.DEFAULT_LOCALE);
		expect(copy.BLOCKS.map((block) => block.name)).toEqual(site.BLOCKS.map((block) => block.name));
		expect(copy.ADMIN_PATH).toBe(site.ADMIN_PATH);
		expect(copy.adminUrl("/login")).toBe(site.adminUrl("/login"));
		expect(copy.SITE_NAME).toBe(site.SITE_NAME);
		expect(copy.ADMIN_LANGUAGE).toBe(site.ADMIN_LANGUAGE);
		expect(copy.CMS_TIME_ZONE).toBe(site.CMS_TIME_ZONE);
		expect(copy.localizePath(site.DEFAULT_LOCALE, "/x")).toBe(site.localizePath(site.DEFAULT_LOCALE, "/x"));
	});
});

/** Compile-time checks (only `tsc` reads them): the instance keeps the type of its config. */
describe("instance types", () => {
	it("keeps the config's types", () => {
		// Never run: the calls below only exist to be type-checked.
		const check = () => {
			const server = stubServer("types").server;
			const cmsBlog = createCms({ config: blog, server });
			const cmsOther = createCms({ config: other, server });

			// An instance of any config is accepted where `Cms` (any config) is expected.
			const any: Cms = cmsBlog;
			const anyOther: Cms = cmsOther;
			void any;
			void anyOther;

			// Collection names and metadata come from the config.
			void cmsBlog.read.listEntries({ collection: "post" });
			void cmsOther.read.listEntries({ collection: "article" });
			// @ts-expect-error `article` is not a collection of the blog config
			void cmsBlog.read.listEntries({ collection: "article" }).catch(() => undefined);
			// @ts-expect-error `post` is not a collection of the other-site config
			void cmsOther.read.listEntries({ collection: "post" }).catch(() => undefined);
			expectTypeOf(cmsBlog.site.config).toEqualTypeOf<typeof blog>();

			// The component table of an instance, or of a config, names that site's blocks.
			const ofInstance = {
				blocks: { notice: ({ level }: { level: "info" | "warn" }) => createElement("aside", { "data-level": level }) },
			} satisfies DocumentComponentsOf<typeof cmsBlog>;
			const ofConfig = {
				blocks: { "quote-card": ({ author }: { author?: string }) => createElement("figure", null, author) },
			} satisfies DocumentComponentsFor<typeof other>;
			void ofInstance;
			void ofConfig;
			const wrongBlock = {
				// @ts-expect-error `quote-card` is not a block of the blog config
				blocks: { "quote-card": () => null },
			} satisfies DocumentComponentsOf<typeof cmsBlog>;
			void wrongBlock;
		};
		expect(check).toBeTypeOf("function");
	});
});
