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
