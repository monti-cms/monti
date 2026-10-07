import { type AnyCmsConfig, createSite } from "@monti-cms/core/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testConfig } from "../../../../../core/test/site";
import { legacyPreferenceKey, preferenceKey, readPreference, storageNamespace, writePreference } from "../site-storage";

const siteOf = (name: string, adminPath = "/admin") =>
	createSite({
		...testConfig,
		site: { ...testConfig.site, name },
		admin: { ...testConfig.admin, path: adminPath },
	} as AnyCmsConfig);

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

	it("keeps two sites on one origin apart", () => {
		const blog = siteOf("Blog");
		const shop = siteOf("Shop");
		writePreference(blog, "editor-width", "wide");
		expect(readPreference(blog, "editor-width")).toBe("wide");
		expect(readPreference(shop, "editor-width")).toBeNull();
		writePreference(shop, "editor-width", "narrow");
		expect(readPreference(blog, "editor-width")).toBe("wide");
		expect(readPreference(shop, "editor-width")).toBe("narrow");
	});

	it("keeps two admins of one site name apart by their admin path", () => {
		writePreference(siteOf("Blog", "/admin"), "media-view", "list");
		expect(readPreference(siteOf("Blog", "/studio"), "media-view")).toBeNull();
	});

	it("reads a value written under the old key once, and keeps it under the site's own key", () => {
		window.localStorage.setItem(legacyPreferenceKey("editor-width"), "full");
		const blog = siteOf("Blog");
		expect(readPreference(blog, "editor-width")).toBe("full");
		expect(window.localStorage.getItem(preferenceKey(blog, "editor-width"))).toBe("full");
		// Once the site has its own value, a change is not undone by the old key.
		writePreference(blog, "editor-width", "narrow");
		expect(readPreference(blog, "editor-width")).toBe("narrow");
		// The old key stays for another site on the same origin that has not read it yet.
		expect(window.localStorage.getItem(legacyPreferenceKey("editor-width"))).toBe("full");
		expect(readPreference(siteOf("Shop"), "editor-width")).toBe("full");
	});

	it("does not fail when storage is unavailable", () => {
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
