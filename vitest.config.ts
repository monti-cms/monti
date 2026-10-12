import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

// `pnpm test:quick` sets this: only the default project of each package, without the other-site and configured variants (CI runs everything).
const QUICK = process.env.MONTI_TEST_QUICK === "1";

export default defineConfig(({ mode }) => ({
	test: {
		// Runs all packages (`packages/*`) at once. Each package uses its own config file.
		projects: [
			"packages/*",
			...(QUICK
				? []
				: [
						// Regression guard: re-runs the config-sensitive core and admin tests (and the small AI, SEO and syntax sets) with the other-site example config.
						"packages/*/vitest.othersite.config.ts",
						// Re-runs the tests that need a syntax extension switched on in the site config (`mdx({ syntax })`).
						"packages/*/vitest.configured.config.ts",
					]),
		],
		testTimeout: 60000,
		hookTimeout: 60000,
		env: {
			...loadEnv(mode, process.cwd(), ""),
			// Production (Vercel) runs in UTC. Running tests in the local time zone would let
			// regressions in time-zone-sensitive logic, such as displayed dates, slip through on developer machines only.
			TZ: "UTC",
		},
	},
}));
