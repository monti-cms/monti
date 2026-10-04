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

describe("관리자 주소(admin.path)", () => {
	it("설정한 관리자 경로 아래 주소를 만든다", () => {
		expect(adminHrefWith("/studio")).toBe("/studio");
		expect(adminHrefWith("/studio", "/")).toBe("/studio");
		expect(adminHrefWith("/studio", "/media")).toBe("/studio/media");
		expect(adminHrefWith("/cms/admin", "?collection=post")).toBe("/cms/admin?collection=post");
		expect(() => adminHrefWith("/admin", "media")).toThrow(/must start with/);
	});

	it("사이트 설정을 따른다(없으면 /admin, 사이트 보기는 /)", () => {
		expect(ADMIN_PATH).toBe(cmsConfig.admin?.path ?? DEFAULT_ADMIN_PATH);
		expect(adminHref()).toBe(ADMIN_PATH);
		expect(adminHref("/login")).toBe(`${ADMIN_PATH}/login`);
		expect(adminEntryEditHref("e1")).toBe(`${ADMIN_PATH}/entries/e1/edit`);
		expect(SITE_HOME).toBe(cmsConfig.site?.home ?? "/");
	});
});

describe("하위 경로(Next basePath)", () => {
	afterEach(() => vi.unstubAllEnvs());

	it("basePath가 없으면 주소가 그대로다", () => {
		vi.stubEnv("NEXT_PUBLIC_CMS_BASE_PATH", "");
		expect(cmsBasePath()).toBe("");
		expect(cmsApiUrl("/v1/entries?page=2")).toBe("/api/cms/v1/entries?page=2");
		expect(withBasePath("/x")).toBe("/x");
		expect(adminUrl("/login")).toBe(adminHref("/login"));
	});

	it("basePath가 있으면 API 주소와 브라우저 주소 앞에 붙고, Link용 adminHref는 그대로다", () => {
		vi.stubEnv("NEXT_PUBLIC_CMS_BASE_PATH", "/blog");
		expect(cmsApiUrl("/v1/entries/e1")).toBe("/blog/api/cms/v1/entries/e1");
		expect(withBasePath("/preview/post/a")).toBe("/blog/preview/post/a");
		expect(adminUrl()).toBe(`/blog${ADMIN_PATH}`);
		expect(adminUrl("/login")).toBe(`/blog${ADMIN_PATH}/login`);
		expect(adminHref("/login")).toBe(`${ADMIN_PATH}/login`);
	});

	it("basePath 값의 앞뒤 빗금을 고른다", () => {
		expect(normalizeBasePath(undefined)).toBe("");
		expect(normalizeBasePath("")).toBe("");
		expect(normalizeBasePath("/")).toBe("");
		expect(normalizeBasePath("blog/")).toBe("/blog");
		expect(normalizeBasePath("/a/b//")).toBe("/a/b");
	});

	it("API 경로는 /로 시작해야 한다", () => {
		expect(() => cmsApiUrl("v1/entries")).toThrow(/must start with/);
	});
});

describe("언어 주소(site.localePrefix)", () => {
	it("방식마다 접두사가 다르다", () => {
		expect(localePrefixFor("ko", "except-default", "ko")).toBe("");
		expect(localePrefixFor("en", "except-default", "ko")).toBe("/en");
		expect(localePrefixFor("ko", "always", "ko")).toBe("/ko");
		expect(localePrefixFor("en", "never", "ko")).toBe("");
		expect(localizePathWith("/en", "/")).toBe("/en");
		expect(localizePathWith("/en", "/posts/a")).toBe("/en/posts/a");
		expect(localizePathWith("", "/posts/a")).toBe("/posts/a");
	});

	it("사이트 설정을 따르고, 모르는 언어에는 붙이지 않는다", () => {
		const mode = cmsConfig.site?.localePrefix ?? "except-default";
		for (const locale of LOCALES) {
			expect(localePrefix(locale)).toBe(localePrefixFor(locale, mode, DEFAULT_LOCALE));
			expect(localizePath(locale, "/a")).toBe(`${localePrefixFor(locale, mode, DEFAULT_LOCALE)}/a`);
		}
		expect(localePrefix("xx-unknown")).toBe("");
	});
});

describe("미리보기 주소의 언어(site.previewLocaleParam)", () => {
	const base = { previewPath: "/preview/", path: "/posts/a", defaultLocale: "ko" };
	it("기본은 기본 언어가 아닐 때 `?locale=`이다", () => {
		expect(previewHrefWith({ ...base, locale: "en", param: "locale", localePrefix: "/en" })).toBe(
			"/preview/posts/a?locale=en",
		);
		expect(previewHrefWith({ ...base, locale: "ko", param: "locale", localePrefix: "" })).toBe("/preview/posts/a");
		expect(previewHrefWith({ ...base, locale: "en", param: "lang", localePrefix: "/en" })).toBe(
			"/preview/posts/a?lang=en",
		);
	});

	it("`false`면 언어 접두사를 경로에 넣는다", () => {
		expect(previewHrefWith({ ...base, locale: "en", param: false, localePrefix: "/en" })).toBe("/preview/en/posts/a");
		expect(previewHrefWith({ ...base, locale: "ko", param: false, localePrefix: "" })).toBe("/preview/posts/a");
	});
});
