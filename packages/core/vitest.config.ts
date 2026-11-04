import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		include: ["src/**/*.test.ts"],
		globalSetup: ["src/__test__/global-setup.ts"],
		// Every integration test file migrates its own schema in the test database, so files can run side by side.
		testTimeout: 20_000,
	},
});
