import path from "node:path";
import { packageTests } from "../../vitest.shared";
import { configSensitiveTests } from "./test/config-sensitive";

/**
 * Regression guard: reruns the config-sensitive core tests with a config whose collections, fields, locales and blocks differ from the reference blog (`test/other-site.config.ts`).
 *
 * Which tests run: only those that read the site config, that is, every test file that imports `test/site.ts` directly or through helpers such as
 * `test/any-site.ts` and the store contract suites (`test/config-sensitive.ts` finds them when this config loads, so a new `any-site` test joins by itself).
 * A test that never touches the config gives the same result under any config, and the default run already covers it.
 * Collection, field and block names are looked up from the config (`test/any-site.ts`). Tests that assert the reference blog config's values as is
 * (collection list, URLs, entry hashes, etc.) live in `*.blog.test.ts` and `*.blog.int.test.ts` and are skipped here.
 */
const SITE_FILE = path.resolve(import.meta.dirname, "./test/site.ts");

export default packageTests({
	dir: import.meta.dirname,
	name: "core",
	site: "other-site",
	include: configSensitiveTests({
		packageDir: import.meta.dirname,
		siteFile: SITE_FILE,
		transitive: true,
		skip: (file) => /\.blog\.(?:int\.)?test\.tsx?$/.test(file),
	}),
	alias: [{ find: /^@monti-cms\/core$/, replacement: path.resolve(import.meta.dirname, "./src/index.ts") }],
});
