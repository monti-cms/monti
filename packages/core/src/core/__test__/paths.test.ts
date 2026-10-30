import { afterEach, describe, expect, it, vi } from "vitest";
import { testConfig, testSite } from "../../../test/site";
import {
	adminApiUrl,
	adminHrefWith,
	cmsBasePath,
	DEFAULT_ADMIN_PATH,
	normalizeBasePath,
	withBasePath,
} from "../admin-paths";
import { previewHrefWith } from "../links";
import { localePrefixFor, localizePathWith } from "../locales";

describe("admin addresses (admin.path)", () => {
	it("builds addresses under the configured admin path", () => {
		expect(adminHrefWith("/studio")).toBe("/studio");
		expect(adminHrefWith("/studio", "/")).toBe("/studio");
		expect(adminHrefWith("/studio", "/media")).toBe("/studio/media");
		expect(adminHrefWith("/cms/admin", "?collection=post")).toBe("/cms/admin?collection=post");
		expect(() => adminHrefWith("/admin", "media")).toThrow(/must start with/);
	});

	it("follows the site config (/admin if absent)", () => {
		expect(testSite.ADMIN_PATH).toBe(testConfig.admin?.path ?? DEFAULT_ADMIN_PATH);
		expect(testSite.adminHref()).toBe(testSite.ADMIN_PATH);
		expect(testSite.adminHref("/login")).toBe(`${testSite.ADMIN_PATH}/login`);
		expect(testSite.adminEntryEditHref("e1")).toBe(`${testSite.ADMIN_PATH}/entries/e1/edit`);
	});
});

describe("sub-path (Next basePath)", () => {
	afterEach(() => vi.unstubAllEnvs());

	it("addresses are unchanged without basePath", () => {
		vi.stubEnv("NEXT_PUBLIC_CMS_BASE_PATH", "");
		expect(cmsBasePath()).toBe("");
		expect(adminApiUrl("/v1/entries?page=2")).toBe("/api/monti/v1/entries?page=2");
		expect(withBasePath("/x")).toBe("/x");
		expect(testSite.adminUrl("/login")).toBe(testSite.adminHref("/login"));
	});

	it("basePath prefixes API and browser addresses, while testSite.adminHref for Link is unchanged", () => {
		vi.stubEnv("NEXT_PUBLIC_CMS_BASE_PATH", "/blog");
		expect(adminApiUrl("/v1/entries/e1")).toBe("/blog/api/monti/v1/entries/e1");
		expect(withBasePath("/preview/post/a")).toBe("/blog/preview/post/a");
		expect(testSite.adminUrl()).toBe(`/blog${testSite.ADMIN_PATH}`);
		expect(testSite.adminUrl("/login")).toBe(`/blog${testSite.ADMIN_PATH}/login`);
		expect(testSite.adminHref("/login")).toBe(`${testSite.ADMIN_PATH}/login`);
	});

	it("normalizes leading and trailing slashes of the basePath value", () => {
		expect(normalizeBasePath(undefined)).toBe("");
		expect(normalizeBasePath("")).toBe("");
		expect(normalizeBasePath("/")).toBe("");
		expect(normalizeBasePath("blog/")).toBe("/blog");
		expect(normalizeBasePath("/a/b//")).toBe("/a/b");
	});

	it("API paths must start with /", () => {
		expect(() => adminApiUrl("v1/entries")).toThrow(/must start with/);
	});
});

describe("locale addresses (site.localePrefix)", () => {
	it("the prefix differs per style", () => {
		expect(localePrefixFor("de", "except-default", "de")).toBe("");
		expect(localePrefixFor("en", "except-default", "de")).toBe("/en");
		expect(localePrefixFor("de", "always", "de")).toBe("/de");
		expect(localePrefixFor("en", "never", "de")).toBe("");
		expect(localizePathWith("/en", "/")).toBe("/en");
		expect(localizePathWith("/en", "/posts/a")).toBe("/en/posts/a");
		expect(localizePathWith("", "/posts/a")).toBe("/posts/a");
	});

	it("follows the site config and adds no prefix to unknown locales", () => {
		const mode = testConfig.site?.localePrefix ?? "except-default";
		for (const locale of testSite.LOCALES) {
			expect(testSite.localePrefix(locale)).toBe(localePrefixFor(locale, mode, testSite.DEFAULT_LOCALE));
			expect(testSite.localizePath(locale, "/a")).toBe(`${localePrefixFor(locale, mode, testSite.DEFAULT_LOCALE)}/a`);
		}
		expect(testSite.localePrefix("xx-unknown")).toBe("");
	});
});

describe("locale of preview addresses (site.previewLocaleParam)", () => {
	const base = { previewPath: "/preview/", path: "/posts/a", defaultLocale: "de" };
	it("by default `?locale=` is used when the locale is not the default", () => {
		expect(previewHrefWith({ ...base, locale: "en", param: "locale", localePrefix: "/en" })).toBe(
			"/preview/posts/a?locale=en",
		);
		expect(previewHrefWith({ ...base, locale: "de", param: "locale", localePrefix: "" })).toBe("/preview/posts/a");
		expect(previewHrefWith({ ...base, locale: "en", param: "lang", localePrefix: "/en" })).toBe(
			"/preview/posts/a?lang=en",
		);
	});

	it("with `false` the locale prefix goes in the path", () => {
		expect(previewHrefWith({ ...base, locale: "en", param: false, localePrefix: "/en" })).toBe("/preview/en/posts/a");
		expect(previewHrefWith({ ...base, locale: "de", param: false, localePrefix: "" })).toBe("/preview/posts/a");
	});
});
