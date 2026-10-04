import path from "node:path";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

/**
 * Regression guard: reruns the SEO extension tests with a config (`test/other-site.config.ts`) whose SEO field names, tab and language differ from the example blog.
 * Fields are found by role in the config. Only tests that use the example blog config's field names as they are are excluded below.
 */
const BLOG_FIXTURE_TESTS = ["src/__test__/blog-seo.test.ts"];

export default defineConfig(({ mode }) => ({
	test: {
		name: "seo (other-site)",
		environment: "jsdom",
		globals: true,
		include: ["src/**/*.{test,spec}.{ts,tsx}"],
		exclude: BLOG_FIXTURE_TESTS,
		setupFiles: ["../admin/src/test/setup-dom.ts"],
		sequence: { groupOrder: 3 },
		testTimeout: 60000,
		hookTimeout: 60000,
		env: {
			...loadEnv(mode, path.resolve(__dirname, "../.."), ""),
			...loadEnv(mode, __dirname, ""),
			TZ: "UTC",
		},
	},
	resolve: {
		alias: {
			"@cms-config": path.resolve(__dirname, "./test/other-site.config.ts"),
			"@cms-server": path.resolve(__dirname, "../core/test/cms.server.ts"),
			"server-only": path.resolve(__dirname, "../core/test/server-only.ts"),
		},
	},
}));
