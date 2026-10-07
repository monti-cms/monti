import path from "node:path";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => ({
	test: {
		name: "admin",
		environment: "jsdom",
		globals: true,
		include: ["src/**/*.{test,spec}.{ts,tsx}"],
		setupFiles: ["./src/test/setup-dom.ts"],
		// When run together from the repo root, this runs after the core bundle (`vitest.config.ts`).
		sequence: { groupOrder: 2 },
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
