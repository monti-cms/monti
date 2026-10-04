import { describe, expect, it } from "vitest";
import { contentCollection, defaultLocale, recordCollection, secondLocale } from "../../../test/any-site";
import { cmsConfig } from "../../config/resolved";
import { schemaOf } from "../../schema/derive";
import { COLLECTIONS } from "../collections";
import { contentPath, LINKABLE_COLLECTIONS, parseContentPath, parseInternalLink, previewHref } from "../links";

/**
 * Internal body link rules that do not depend on the config. Collections, public paths and the site address are looked up in the current config (`test/any-site.ts`).
 * `links.blog.test.ts` checks the addresses of the reference blog config as is.
 */
const pathOf = (slug: string) => {
	const path = schemaOf(contentCollection).path;
	if (!path) throw new Error("links test: the content collection has no path");
	return path.replace(":slug", slug);
};
const siteHost = new URL(cmsConfig.site?.url ?? "https://example.invalid").hostname;
const aliasHost = cmsConfig.site?.aliases?.[0] ?? siteHost;

describe("internal body link rules", () => {
	it("only collections with a path can be linked to", () => {
		expect(LINKABLE_COLLECTIONS).toEqual(COLLECTIONS.filter((name) => schemaOf(name).path));
		expect(LINKABLE_COLLECTIONS).toContain(contentCollection);
		expect(contentPath(contentCollection, "nextjs-guide")).toBe(pathOf("nextjs-guide"));
		expect(contentPath(contentCollection, "한글 메모")).toBe(pathOf("한글%20메모"));
		expect(contentPath(recordCollection, "react")).toBeNull();
		expect(contentPath(contentCollection, "")).toBeNull();
	});

	it("reads the collection and slug from a path", () => {
		expect(parseContentPath(pathOf("a"))).toEqual({ collection: contentCollection, slug: "a" });
		// A trailing slash makes no difference; it is the same post.
		const encoded = pathOf("%ED%95%9C%EA%B8%80").replace(/\/?$/, "/");
		expect(parseContentPath(encoded)).toEqual({ collection: contentCollection, slug: "한글" });
		expect(parseContentPath(pathOf("a/b"))).toBeNull();
		expect(parseContentPath(`/${recordCollection}-unknown/react`)).toBeNull();
		expect(parseContentPath(pathOf("%E0%A4%A"))).toBeNull();
	});

	it("only links written as a path or with the site address count as internal links", () => {
		const relative = `${pathOf("a")}?x=1#h`;
		expect(parseInternalLink(relative)).toEqual({ collection: contentCollection, slug: "a", url: relative });
		expect(parseInternalLink(`https://${aliasHost}${pathOf("b")}`)?.slug).toBe("b");
		expect(parseInternalLink(`//${siteHost}${pathOf("c")}`)?.slug).toBe("c");
		expect(parseInternalLink(`https://other.example.com${pathOf("a")}`)).toBeNull();
		expect(parseInternalLink(`mailto:me@${siteHost}`)).toBeNull();
		expect(parseInternalLink(pathOf("a").slice(1))).toBeNull();
	});
});

describe("draft preview addresses", () => {
	const previewPath = cmsConfig.site?.previewPath;

	it.skipIf(!previewPath)("appends the public path under the preview path", () => {
		const href = previewHref(contentCollection, "nextjs-guide", defaultLocale);
		expect(href?.startsWith(previewPath?.replace(/\/$/, "") ?? "")).toBe(true);
		expect(href?.endsWith(pathOf("nextjs-guide"))).toBe(true);
		expect(previewHref(recordCollection, "react")).toBeNull();
		expect(previewHref(contentCollection, null)).toBeNull();
	});

	// For a non-default locale the locale is passed (as a query or a path prefix). A config with only one locale has none.
	it.skipIf(!previewPath || !secondLocale)("passes the locale when it is not the default", () => {
		const href = previewHref(contentCollection, "한글 메모", secondLocale);
		expect(href).toContain(secondLocale);
		expect(href).toContain(encodeURIComponent("한글 메모"));
		expect(href).not.toBe(previewHref(contentCollection, "한글 메모", defaultLocale));
	});
});
