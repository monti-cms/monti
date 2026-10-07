import path from "node:path";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => ({
	test: {
		name: "mdx",
		// The source panel tests run in a browser environment (`// @vitest-environment jsdom` in the file); the rest of the package needs none.
		environment: "node",
		globals: true,
		include: ["src/**/*.{test,spec}.{ts,tsx}"],
		setupFiles: ["../admin/src/test/setup-dom.ts"],
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
