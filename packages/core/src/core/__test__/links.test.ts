import { describe, expect, it } from "vitest";
import { contentCollection, defaultLocale, recordCollection, secondLocale } from "../../../test/any-site";
import { testConfig, testSite } from "../../../test/site";
import { previewHrefWith } from "../links";

/**
 * Internal body link rules that do not depend on the config. Collections, public paths and the site address are looked up in the current config (`test/any-site.ts`).
 * `links.blog.test.ts` checks the addresses of the reference blog config as is.
 */
const pathOf = (slug: string) => {
	const path = testSite.schemaOf(contentCollection).path;
	if (!path) throw new Error("links test: the content collection has no path");
	return path.replace(":slug", slug);
};
const siteHost = new URL(testConfig.site?.url ?? "https://example.invalid").hostname;
const aliasHost = testConfig.site?.aliases?.[0] ?? siteHost;

describe("internal body link rules", () => {
	it("SITE-R8 only collections with a path can be linked to", () => {
		expect(testSite.LINKABLE_COLLECTIONS).toEqual(testSite.COLLECTIONS.filter((name) => testSite.schemaOf(name).path));
		expect(testSite.LINKABLE_COLLECTIONS).toContain(contentCollection);
		expect(testSite.contentPath(contentCollection, "nextjs-guide")).toBe(pathOf("nextjs-guide"));
		expect(testSite.contentPath(contentCollection, "한글 메모")).toBe(pathOf("한글%20메모"));
		expect(testSite.contentPath(recordCollection, "react")).toBeNull();
		expect(testSite.contentPath(contentCollection, "")).toBeNull();
	});

	it("SITE-R3 reads the collection and slug from a path", () => {
		expect(testSite.parseContentPath(pathOf("a"))).toEqual({ collection: contentCollection, slug: "a" });
		// A trailing slash makes no difference; it is the same post.
		const encoded = pathOf("%ED%95%9C%EA%B8%80").replace(/\/?$/, "/");
		expect(testSite.parseContentPath(encoded)).toEqual({ collection: contentCollection, slug: "한글" });
		expect(testSite.parseContentPath(pathOf("a/b"))).toBeNull();
		expect(testSite.parseContentPath(`/${recordCollection}-unknown/react`)).toBeNull();
		expect(testSite.parseContentPath(pathOf("%E0%A4%A"))).toBeNull();
	});

	it("SITE-R3 reads the language of a path that has the locale prefix of the site's URLs", () => {
		for (const locale of [defaultLocale, secondLocale]) {
			if (!locale) continue;
			const prefixed = testSite.localizePath(locale, pathOf("a"));
			// Without a prefix there is nothing to read: the default language.
			expect(testSite.parseContentPath(prefixed)).toEqual(
				prefixed === pathOf("a")
					? { collection: contentCollection, slug: "a" }
					: { collection: contentCollection, slug: "a", locale },
			);
		}
	});

	it("SITE-R3 only links written as a path or with the site address count as internal links", () => {
		const relative = `${pathOf("a")}?x=1#h`;
		expect(testSite.parseInternalLink(relative)).toEqual({ collection: contentCollection, slug: "a", url: relative });
		expect(testSite.parseInternalLink(`https://${aliasHost}${pathOf("b")}`)?.slug).toBe("b");
		expect(testSite.parseInternalLink(`//${siteHost}${pathOf("c")}`)?.slug).toBe("c");
		expect(testSite.parseInternalLink(`https://other.example.com${pathOf("a")}`)).toBeNull();
		expect(testSite.parseInternalLink(`mailto:me@${siteHost}`)).toBeNull();
		expect(testSite.parseInternalLink(pathOf("a").slice(1))).toBeNull();
	});
});

describe("draft preview addresses", () => {
	const previewPath = testConfig.site?.previewPath;

	it.skipIf(!previewPath)("WRITE-W8 appends the public path under the preview path", () => {
		const href = testSite.previewHref(contentCollection, "nextjs-guide", defaultLocale);
		expect(href?.startsWith(previewPath?.replace(/\/$/, "") ?? "")).toBe(true);
		expect(href?.endsWith(pathOf("nextjs-guide"))).toBe(true);
		expect(testSite.previewHref(recordCollection, "react")).toBeNull();
		expect(testSite.previewHref(contentCollection, null)).toBeNull();
	});

	// For a non-default locale the locale is passed (as a query or a path prefix). A config with only one locale has none.
	it.skipIf(!previewPath || !secondLocale)("WRITE-W8 passes the locale when it is not the default", () => {
		const href = testSite.previewHref(contentCollection, "한글 메모", secondLocale);
		expect(href).toContain(secondLocale);
		expect(href).toContain(encodeURIComponent("한글 메모"));
		expect(href).not.toBe(testSite.previewHref(contentCollection, "한글 메모", defaultLocale));
	});
});

describe("locale of preview addresses (site.previewLocaleParam)", () => {
	const base = { previewPath: "/preview/", path: "/posts/a", defaultLocale: "de" };
	it("WRITE-W8 by default `?locale=` is used when the locale is not the default", () => {
		expect(previewHrefWith({ ...base, locale: "en", param: "locale", localePrefix: "/en" })).toBe(
			"/preview/posts/a?locale=en",
		);
		expect(previewHrefWith({ ...base, locale: "de", param: "locale", localePrefix: "" })).toBe("/preview/posts/a");
		expect(previewHrefWith({ ...base, locale: "en", param: "lang", localePrefix: "/en" })).toBe(
			"/preview/posts/a?lang=en",
		);
	});

	it("WRITE-W8 with `false` the locale prefix goes in the path", () => {
		expect(previewHrefWith({ ...base, locale: "en", param: false, localePrefix: "/en" })).toBe("/preview/en/posts/a");
		expect(previewHrefWith({ ...base, locale: "de", param: false, localePrefix: "" })).toBe("/preview/posts/a");
	});
});
