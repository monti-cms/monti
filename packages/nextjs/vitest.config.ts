import path from "node:path";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => ({
	test: {
		name: "nextjs",
		environment: "jsdom",
		globals: true,
		include: ["src/**/*.{test,spec}.{ts,tsx}"],
		setupFiles: ["../admin/src/test/setup-dom.ts"],
		// When run together from the repo root, this runs after the core bundle (`vitest.config.ts`).
		sequence: { groupOrder: 3 },
		testTimeout: 60000,
		hookTimeout: 60000,
		env: {
			...loadEnv(mode, path.resolve(import.meta.dirname, "../.."), ""),
			...loadEnv(mode, import.meta.dirname, ""),
			TZ: "UTC",
		},
	},
	resolve: {
		alias: {
			"server-only": path.resolve(import.meta.dirname, "../core/test/server-only.ts"),
		},
	},
}));
