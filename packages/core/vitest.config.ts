import path from "node:path";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => ({
	test: {
		name: "core",
		environment: "node",
		globals: true,
		include: ["src/**/*.{test,spec}.{ts,tsx}"],
		exclude: ["**/node_modules/**"],
		// When run together from the repo root, this runs first (`vitest.config.ts`).
		sequence: { groupOrder: 1 },
		testTimeout: 60000,
		hookTimeout: 60000,
		env: {
			// Reads the same `.env.local` whether run from the repo root or from this package.
			...loadEnv(mode, path.resolve(__dirname, "../.."), ""),
			...loadEnv(mode, __dirname, ""),
			TZ: "UTC",
		},
	},
	resolve: {
		alias: {
			// The package's own tests run against the reference blog config.
			"@cms-config": path.resolve(__dirname, "./test/cms.config.ts"),
			"@cms-server": path.resolve(__dirname, "./test/cms.server.ts"),
			"server-only": path.resolve(__dirname, "./test/server-only.ts"),
		},
	},
}));
