import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		include: ["src/**/*.test.ts"],
		// Every integration test file migrates its own schema in the test database, so files can run side by side.
		testTimeout: 20_000,
	},
});
