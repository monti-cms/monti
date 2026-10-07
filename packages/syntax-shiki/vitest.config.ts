import path from "node:path";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => ({
	test: {
		name: "syntax-shiki",
		environment: "node",
		globals: true,
		include: ["src/**/*.{test,spec}.{ts,tsx}"],
		// Tests that need the extension in the site config run in `vitest.configured.config.ts`.
		exclude: ["src/**/*.configured.test.{ts,tsx}", "**/node_modules/**"],
		// When run together from the repository root, it runs with the core tests (`vitest.config.ts`).
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
			"server-only": path.resolve(__dirname, "../core/test/server-only.ts"),
		},
	},
}));
