import path from "node:path";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => ({
	test: {
		name: "example-recipes",
		environment: "node",
		globals: true,
		include: ["src/**/*.test.{ts,tsx}"],
		setupFiles: ["../../packages/admin/src/test/setup-dom.ts"],
		// When run together from the repository root, it runs after the package projects (`vitest.config.ts`).
		sequence: { groupOrder: 4 },
		testTimeout: 60000,
		hookTimeout: 60000,
		env: { ...loadEnv(mode, path.resolve(__dirname, "../.."), ""), TZ: "UTC" },
	},
	resolve: { alias: { "server-only": path.resolve(__dirname, "../../packages/core/test/server-only.ts") } },
}));
