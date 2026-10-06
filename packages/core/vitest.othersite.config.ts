import path from "node:path";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

/**
 * Regression guard: reruns the core tests with a config whose collections, fields, locales and blocks differ from the reference blog (`test/other-site.config.ts`).
 * New tests join this set automatically. Collection, field and block names are looked up from the config (`test/any-site.ts`).
 * Tests that assert the reference blog config's values as is (collection list, URLs, entry hashes, etc.) live in `*.blog.test.ts` and are excluded here.
 */
const BLOG_FIXTURE_TESTS = ["src/**/*.blog.test.ts"];

export default defineConfig(({ mode }) => ({
	test: {
		name: "core (other-site)",
		environment: "node",
		globals: true,
		include: ["src/**/*.{test,spec}.{ts,tsx}"],
		exclude: BLOG_FIXTURE_TESTS,
		sequence: { groupOrder: 1 },
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
			"server-only": path.resolve(__dirname, "./test/server-only.ts"),
		},
	},
}));
