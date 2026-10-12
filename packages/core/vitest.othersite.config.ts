import path from "node:path";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

import { configSensitiveTests } from "./test/config-sensitive";

/**
 * Regression guard: reruns the config-sensitive core tests with a config whose collections, fields, locales and blocks differ from the reference blog (`test/other-site.config.ts`).
 *
 * Which tests run: only those that read the site config, that is, every test file that imports `test/site.ts` directly or through helpers such as
 * `test/any-site.ts` and the store contract suites (`test/config-sensitive.ts` finds them when this config loads, so a new `any-site` test joins by itself).
 * A test that never touches the config gives the same result under any config, and the default run already covers it.
 * Collection, field and block names are looked up from the config (`test/any-site.ts`). Tests that assert the reference blog config's values as is
 * (collection list, URLs, entry hashes, etc.) live in `*.blog.test.ts` and are skipped here.
 */
const SITE_FILE = path.resolve(__dirname, "./test/site.ts");

export default defineConfig(({ mode }) => ({
	test: {
		name: "core (other-site)",
		environment: "node",
		globals: true,
		include: configSensitiveTests({
			packageDir: __dirname,
			siteFile: SITE_FILE,
			transitive: true,
			skip: (file) => /\.blog\.test\.tsx?$/.test(file),
		}),
		sequence: { groupOrder: 1 },
		testTimeout: 60000,
		hookTimeout: 60000,
		env: {
			...loadEnv(mode, path.resolve(__dirname, "../.."), ""),
			...loadEnv(mode, __dirname, ""),
			TZ: "UTC",
			// `test/site.ts` picks the config the suites run against.
			MONTI_TEST_SITE: "other-site",
		},
	},
	resolve: {
		alias: [
			{ find: "server-only", replacement: path.resolve(__dirname, "./test/server-only.ts") },
			{ find: /^@monti-cms\/core$/, replacement: path.resolve(__dirname, "./src/index.ts") },
		],
	},
}));
