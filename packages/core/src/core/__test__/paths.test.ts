import { afterEach, describe, expect, it, vi } from "vitest";
import { cmsConfig } from "../../config/resolved";
import {
	ADMIN_PATH,
	adminEntryEditHref,
	adminHref,
	adminHrefWith,
	adminUrl,
	cmsApiUrl,
	cmsBasePath,
	DEFAULT_ADMIN_PATH,
	normalizeBasePath,
	SITE_HOME,
	withBasePath,
} from "../admin-paths";
import { previewHrefWith } from "../links";
import { DEFAULT_LOCALE, LOCALES, localePrefix, localePrefixFor, localizePath, localizePathWith } from "../locales";

describe("admin addresses (admin.path)", () => {
	it("builds addresses under the configured admin path", () => {
		expect(adminHrefWith("/studio")).toBe("/studio");
		expect(adminHrefWith("/studio", "/")).toBe("/studio");
		expect(adminHrefWith("/studio", "/media")).toBe("/studio/media");
		expect(adminHrefWith("/cms/admin", "?collection=post")).toBe("/cms/admin?collection=post");
		expect(() => adminHrefWith("/admin", "media")).toThrow(/must start with/);
	});

	it("follows the site config (/admin if absent, view site is /)", () => {
		expect(ADMIN_PATH).toBe(cmsConfig.admin?.path ?? DEFAULT_ADMIN_PATH);
		expect(adminHref()).toBe(ADMIN_PATH);
		expect(adminHref("/login")).toBe(`${ADMIN_PATH}/login`);
		expect(adminEntryEditHref("e1")).toBe(`${ADMIN_PATH}/entries/e1/edit`);
		expect(SITE_HOME).toBe(cmsConfig.site?.home ?? "/");
	});
});

describe("sub-path (Next basePath)", () => {
	afterEach(() => vi.unstubAllEnvs());

	it("addresses are unchanged without basePath", () => {
		vi.stubEnv("NEXT_PUBLIC_CMS_BASE_PATH", "");
		expect(cmsBasePath()).toBe("");
		expect(cmsApiUrl("/v1/entries?page=2")).toBe("/api/cms/v1/entries?page=2");
		expect(withBasePath("/x")).toBe("/x");
		expect(adminUrl("/login")).toBe(adminHref("/login"));
	});

	it("basePath prefixes API and browser addresses, while adminHref for Link is unchanged", () => {
		vi.stubEnv("NEXT_PUBLIC_CMS_BASE_PATH", "/blog");
		expect(cmsApiUrl("/v1/entries/e1")).toBe("/blog/api/cms/v1/entries/e1");
		expect(withBasePath("/preview/post/a")).toBe("/blog/preview/post/a");
		expect(adminUrl()).toBe(`/blog${ADMIN_PATH}`);
		expect(adminUrl("/login")).toBe(`/blog${ADMIN_PATH}/login`);
		expect(adminHref("/login")).toBe(`${ADMIN_PATH}/login`);
	});

	it("normalizes leading and trailing slashes of the basePath value", () => {
		expect(normalizeBasePath(undefined)).toBe("");
		expect(normalizeBasePath("")).toBe("");
		expect(normalizeBasePath("/")).toBe("");
		expect(normalizeBasePath("blog/")).toBe("/blog");
		expect(normalizeBasePath("/a/b//")).toBe("/a/b");
	});

	it("API paths must start with /", () => {
		expect(() => cmsApiUrl("v1/entries")).toThrow(/must start with/);
	});
});

describe("locale addresses (site.localePrefix)", () => {
	it("the prefix differs per style", () => {
		expect(localePrefixFor("ko", "except-default", "ko")).toBe("");
		expect(localePrefixFor("en", "except-default", "ko")).toBe("/en");
		expect(localePrefixFor("ko", "always", "ko")).toBe("/ko");
		expect(localePrefixFor("en", "never", "ko")).toBe("");
		expect(localizePathWith("/en", "/")).toBe("/en");
		expect(localizePathWith("/en", "/posts/a")).toBe("/en/posts/a");
		expect(localizePathWith("", "/posts/a")).toBe("/posts/a");
	});

	it("follows the site config and adds no prefix to unknown locales", () => {
		const mode = cmsConfig.site?.localePrefix ?? "except-default";
		for (const locale of LOCALES) {
			expect(localePrefix(locale)).toBe(localePrefixFor(locale, mode, DEFAULT_LOCALE));
			expect(localizePath(locale, "/a")).toBe(`${localePrefixFor(locale, mode, DEFAULT_LOCALE)}/a`);
		}
		expect(localePrefix("xx-unknown")).toBe("");
	});
});

describe("locale of preview addresses (site.previewLocaleParam)", () => {
	const base = { previewPath: "/preview/", path: "/posts/a", defaultLocale: "ko" };
	it("by default `?locale=` is used when the locale is not the default", () => {
		expect(previewHrefWith({ ...base, locale: "en", param: "locale", localePrefix: "/en" })).toBe(
			"/preview/posts/a?locale=en",
		);
		expect(previewHrefWith({ ...base, locale: "ko", param: "locale", localePrefix: "" })).toBe("/preview/posts/a");
		expect(previewHrefWith({ ...base, locale: "en", param: "lang", localePrefix: "/en" })).toBe(
			"/preview/posts/a?lang=en",
		);
	});

	it("with `false` the locale prefix goes in the path", () => {
		expect(previewHrefWith({ ...base, locale: "en", param: false, localePrefix: "/en" })).toBe("/preview/en/posts/a");
		expect(previewHrefWith({ ...base, locale: "ko", param: false, localePrefix: "" })).toBe("/preview/posts/a");
	});
});
