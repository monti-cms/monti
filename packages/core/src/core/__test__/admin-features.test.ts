import { describe, expect, it } from "vitest";
import { createAdminFeatures } from "../admin-features";

const twoLocales = [
	{ code: "ko", name: "한국어" },
	{ code: "en", name: "English" },
];

describe("admin features of a site", () => {
	it("offers templates and translations by default on a site with several locales", () => {
		expect(createAdminFeatures({ locales: twoLocales })).toEqual({ ADMIN_TEMPLATES: true, ADMIN_TRANSLATIONS: true });
	});
});
