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

describe("admin addresses (admin.path)", () => {
	it("ADMIN-U1 builds addresses under the configured admin path", () => {
		expect(adminHrefWith("/studio")).toBe("/studio");
		expect(adminHrefWith("/studio", "/")).toBe("/studio");
		expect(adminHrefWith("/studio", "/media")).toBe("/studio/media");
		expect(adminHrefWith("/cms/admin", "?collection=post")).toBe("/cms/admin?collection=post");
		expect(() => adminHrefWith("/admin", "media")).toThrow(/must start with/);
	});

	it("ADMIN-U1 follows the site config (/admin if absent)", () => {
		expect(testSite.ADMIN_PATH).toBe(testConfig.admin?.path ?? DEFAULT_ADMIN_PATH);
		expect(testSite.adminHref()).toBe(testSite.ADMIN_PATH);
		expect(testSite.adminHref("/login")).toBe(`${testSite.ADMIN_PATH}/login`);
		expect(testSite.adminEntryEditHref("e1")).toBe(`${testSite.ADMIN_PATH}/entries/e1/edit`);
	});
});

describe("sub-path (Next basePath)", () => {
	afterEach(() => vi.unstubAllEnvs());

	it("SITE-N1 addresses are unchanged without basePath", () => {
		vi.stubEnv("NEXT_PUBLIC_CMS_BASE_PATH", "");
		expect(cmsBasePath()).toBe("");
		expect(adminApiUrl("/v1/entries?page=2")).toBe("/api/monti/v1/entries?page=2");
		expect(withBasePath("/x")).toBe("/x");
		expect(testSite.adminUrl("/login")).toBe(testSite.adminHref("/login"));
	});

	it("SITE-N1 basePath prefixes API and browser addresses, while testSite.adminHref for Link is unchanged", () => {
		vi.stubEnv("NEXT_PUBLIC_CMS_BASE_PATH", "/blog");
		expect(adminApiUrl("/v1/entries/e1")).toBe("/blog/api/monti/v1/entries/e1");
		expect(withBasePath("/preview/post/a")).toBe("/blog/preview/post/a");
		expect(testSite.adminUrl()).toBe(`/blog${testSite.ADMIN_PATH}`);
		expect(testSite.adminUrl("/login")).toBe(`/blog${testSite.ADMIN_PATH}/login`);
		expect(testSite.adminHref("/login")).toBe(`${testSite.ADMIN_PATH}/login`);
	});

	it("SITE-N1 normalizes leading and trailing slashes of the basePath value", () => {
		expect(normalizeBasePath(undefined)).toBe("");
		expect(normalizeBasePath("")).toBe("");
		expect(normalizeBasePath("/")).toBe("");
		expect(normalizeBasePath("blog/")).toBe("/blog");
		expect(normalizeBasePath("/a/b//")).toBe("/a/b");
	});
});
