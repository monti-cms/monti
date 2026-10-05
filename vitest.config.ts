import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => ({
	test: {
		// Runs all packages (`packages/*`) at once. Each package uses its own config file.
		projects: [
			"packages/*",
			// Regression guard: re-runs the core, admin and AI tests with the other-site example config.
			"packages/*/vitest.othersite.config.ts",
			// Re-runs the tests that need a syntax extension switched on in the site config (`mdx.syntax`).
			"packages/*/vitest.configured.config.ts",
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
