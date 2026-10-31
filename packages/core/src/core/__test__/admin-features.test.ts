import { describe, expect, it } from "vitest";
import { testConfig } from "../../../test/site";
import { createSite } from "../../site";
import { createAdminFeatures } from "../admin-features";

const twoLocales = [
	{ code: "ko", name: "한국어" },
	{ code: "en", name: "English" },
];

describe("admin features of a site", () => {
	it("offers templates and translations by default on a site with several locales", () => {
		expect(createAdminFeatures({ locales: twoLocales })).toEqual({ ADMIN_TEMPLATES: true, ADMIN_TRANSLATIONS: true });
	});

	it("hides the translation UI of a multi-locale site with admin.translations: false", () => {
		expect(createAdminFeatures({ locales: twoLocales, admin: { translations: false } }).ADMIN_TRANSLATIONS).toBe(false);
	});

});
