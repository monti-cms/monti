import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		include: ["src/**/*.test.ts"],
		// The core's test database, for the import through a site: a schema per test file, dropped when the run ends.
		globalSetup: ["../core/src/__test__/global-setup.ts"],
		testTimeout: 20_000,
	},
});
