import path from "node:path";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

/**
 * Reruns the tests that need the directive extension in the site config (`test/directive.config.ts`): the extension reaches the parser,
 * the serializer and the public render chain through `mdx.syntax`, not through an explicit list. Only `*.configured.test.ts` runs here.
 */
export default defineConfig(({ mode }) => ({
	test: {
		name: "syntax-directive (configured)",
		environment: "node",
		globals: true,
		include: ["src/**/*.configured.test.{ts,tsx}"],
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
			"@cms-config": path.resolve(__dirname, "./test/directive.config.ts"),
			"server-only": path.resolve(__dirname, "../core/test/server-only.ts"),
		},
	},
}));
