import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
		globalSetup: ["src/__test__/global-setup.ts"],
	},
});
