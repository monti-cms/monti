import { defineConfig } from "@playwright/test";
import { E2E_URL } from "./env.mjs";

/**
 * Flow tests: one test per canvas flow (docs/design/admin/flows), run in a browser against the example app. `pnpm test:e2e` packs the packages,
 * builds the example and starts it with an empty test database (`e2e/start-example.mjs`); the steps of a flow share one database, so the tests run in order.
 */
export default defineConfig({
	testDir: "flows",
	fullyParallel: false,
	workers: 1,
	timeout: 120_000,
	reporter: [["list"]],
	use: { baseURL: E2E_URL, locale: "ko-KR", viewport: { width: 1440, height: 900 }, trace: "retain-on-failure" },
	outputDir: "test-results",
	webServer: {
		command: "node e2e/start-example.mjs",
		cwd: "..",
		url: `${E2E_URL}/studio/login`,
		timeout: 600_000,
		reuseExistingServer: false,
		stdout: "pipe",
	},
});
