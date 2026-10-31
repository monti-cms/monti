import type { CmsConfig } from "@monti-cms/core";
import { createSite } from "@monti-cms/core/site";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testConfig } from "../../../../../core/test/site";
import { preferenceKey, readPreference, storageNamespace, writePreference } from "../site-storage";

const siteOf = (name: string, adminPath = "/admin") =>
	createSite({
		...testConfig,
		site: { ...testConfig.site, name },
		admin: { ...testConfig.admin, path: adminPath },
	} as CmsConfig);

beforeEach(() => window.localStorage.clear());
afterEach(() => {
	vi.restoreAllMocks();
	window.localStorage.clear();
});

describe("browser storage of a site", () => {
	it("names its keys after the site and its admin path", () => {
		expect(storageNamespace(siteOf("Blog"))).toBe("Blog/admin");
		expect(preferenceKey(siteOf("Blog", "/studio"), "editor-width")).toBe("cms:Blog/studio:editor-width");
	});

	it("keeps two admins of one site name apart by their admin path", () => {
		writePreference(siteOf("Blog", "/admin"), "media-view", "list");
		expect(readPreference(siteOf("Blog", "/studio"), "media-view")).toBeNull();
	});

	it("ADMIN-S1 does not fail when storage is unavailable", () => {
		vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
			throw new Error("blocked");
		});
		vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
			throw new Error("blocked");
		});
		expect(readPreference(siteOf("Blog"), "editor-width")).toBeNull();
		expect(() => writePreference(siteOf("Blog"), "editor-width", "wide")).not.toThrow();
	});
});
