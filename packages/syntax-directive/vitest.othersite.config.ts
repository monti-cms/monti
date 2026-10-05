import path from "node:path";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

/**
 * Regression guard: reruns the directive tests with a config whose blocks differ from the reference blog (`test/other-site.config.ts`).
 * Block names are looked up from the config. Tests that read the reference blog's sample posts (callouts, tabs, tooltips) live in
 * `*.blog.test.ts` and are excluded here.
 */
const BLOG_FIXTURE_TESTS = ["src/**/*.blog.test.ts", "src/**/*.configured.test.{ts,tsx}"];

export default defineConfig(({ mode }) => ({
	test: {
		name: "syntax-directive (other-site)",
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
			"@cms-server": path.resolve(__dirname, "../core/test/cms.server.ts"),
			"server-only": path.resolve(__dirname, "../core/test/server-only.ts"),
		},
	},
}));
