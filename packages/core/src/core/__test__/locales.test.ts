import { describe, expect, it } from "vitest";
import { testConfig, testSite } from "../../../test/site";
import { localePrefixFor, localizePathWith } from "../locales";

describe("locale addresses (site.localePrefix)", () => {
	it("SITE-R8 the prefix differs per style", () => {
		expect(localePrefixFor("de", "except-default", "de")).toBe("");
		expect(localePrefixFor("en", "except-default", "de")).toBe("/en");
		expect(localePrefixFor("de", "always", "de")).toBe("/de");
		expect(localePrefixFor("en", "never", "de")).toBe("");
		expect(localizePathWith("/en", "/")).toBe("/en");
		expect(localizePathWith("/en", "/posts/a")).toBe("/en/posts/a");
		expect(localizePathWith("", "/posts/a")).toBe("/posts/a");
	});

	it("SITE-R8 follows the site config and adds no prefix to unknown locales", () => {
		const mode = testConfig.site?.localePrefix ?? "except-default";
		for (const locale of testSite.LOCALES) {
			expect(testSite.localePrefix(locale)).toBe(localePrefixFor(locale, mode, testSite.DEFAULT_LOCALE));
			expect(testSite.localizePath(locale, "/a")).toBe(`${localePrefixFor(locale, mode, testSite.DEFAULT_LOCALE)}/a`);
		}
		expect(testSite.localePrefix("xx-unknown")).toBe("");
	});
});
