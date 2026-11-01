import path from "node:path";
import { packageTests } from "../../vitest.shared";
import { configSensitiveTests } from "../core/test/config-sensitive";

/**
 * Regression guard: reruns the config-sensitive admin UI tests with a config whose collections, fields, languages and blocks differ from the reference blog (`../core/test/other-site.config.ts`).
 *
 * Which tests run: only those that read the site config (`any-site`, `testConfig`, or the config-derived lookups of `testSite` such as `COLLECTIONS` and `schemaOf`;
 * the exact rule is `READS_CONFIG` in `../core/test/config-sensitive.ts`). A test that only renders with `testSite` and names no collection, field or block
 * gives the same result under any config, and the default run covers it. A new test joins by itself once it reads the config that way.
 * A test that needs the reference blog's own collections, fields, blocks or languages says so in its name (`*.blog.dom.test.tsx`) and is skipped.
 */

/** The config-sensitive test files: this project runs those that need no browser, `vitest.othersite-browser.config.ts` the browser ones. */
export const otherSiteTests = configSensitiveTests({
	packageDir: import.meta.dirname,
	siteFile: path.resolve(import.meta.dirname, "../core/test/site.ts"),
	// The admin helpers (`src/test/*`) render with `testSite` for every test, so following them would select all tests.
	transitive: false,
	// These hand `testSite` to a component that reads the config (the schema screen, link targets) without naming a collection themselves.
	also: [
		"src/editor/__test__/internal-link-display.browser.test.tsx",
		"src/editor/__test__/internal-link-search.dom.test.tsx",
	],
	skip: (file) => /\.blog\.(?:dom\.|browser\.)?test\.[jt]sx?$/.test(file),
});

export default packageTests({
	dir: import.meta.dirname,
	name: "admin",
	site: "other-site",
	environment: "jsdom",
	dom: true,
	include: otherSiteTests,
});
