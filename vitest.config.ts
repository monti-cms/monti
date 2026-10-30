import { defineConfig } from "vitest/config";

// `pnpm test:quick` sets this: only the default project of each package, without the other-site and configured variants (CI runs everything).
const QUICK = process.env.MONTI_TEST_QUICK === "1";

export default defineConfig({
	test: {
		// Runs all packages (`packages/*`) at once. Each package's config is `packageTests` of `vitest.shared.ts` with what differs.
		projects: [
			"packages/*",
			// The L2 tests of a package whose tests are split by layer (`docs/testing.md`).
			"packages/*/vitest.int.config.ts",
			...(QUICK
				? []
				: [
						// Regression guard: re-runs the config-sensitive core and admin tests (and the small AI, SEO and syntax sets) with the other-site example config.
						"packages/*/vitest.othersite.config.ts",
						// Re-runs the tests that need a syntax extension switched on in the site config (`mdx({ syntax })`).
						"packages/*/vitest.configured.config.ts",
					]),
		],
	},
});
