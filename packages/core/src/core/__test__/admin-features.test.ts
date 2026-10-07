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

	it("turns templates off only with admin.templates: false", () => {
		expect(createAdminFeatures({ locales: twoLocales, admin: { templates: false } }).ADMIN_TEMPLATES).toBe(false);
		expect(createAdminFeatures({ locales: twoLocales, admin: { templates: true } }).ADMIN_TEMPLATES).toBe(true);
		expect(createAdminFeatures({ locales: twoLocales, admin: {} }).ADMIN_TEMPLATES).toBe(true);
	});

	it("hides the translation UI of a single-locale site without any option", () => {
		expect(createAdminFeatures({ locales: [twoLocales[0]] as never }).ADMIN_TRANSLATIONS).toBe(false);
	});

	it("keeps it hidden on a single-locale site even when admin.translations is true", () => {
		expect(
			createAdminFeatures({ locales: [twoLocales[0]] as never, admin: { translations: true } }).ADMIN_TRANSLATIONS,
		).toBe(false);
	});

	it("hides the translation UI of a multi-locale site with admin.translations: false", () => {
		expect(createAdminFeatures({ locales: twoLocales, admin: { translations: false } }).ADMIN_TRANSLATIONS).toBe(false);
	});

	it("is part of a site made from a config", () => {
		const site = createSite({ ...testConfig, admin: { ...testConfig.admin, templates: false } });
		expect(site.ADMIN_TEMPLATES).toBe(false);
		expect(site.ADMIN_TRANSLATIONS).toBe(testConfig.locales.length > 1);
	});
});
