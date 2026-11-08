import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

const root = fileURLToPath(new URL("../..", import.meta.url));

/** The site with a media storage, and from doc 09 on a second one without it. L5 does not retry: a failure is the test's or the app's to fix. */
export default defineConfig({
	testDir: ".",
	testMatch: "*.e2e.ts",
	outputDir: "../../node_modules/.cache/monti-e2e",
	retries: 0,
	workers: 1,
	timeout: 45_000,
	reporter: process.env.CI ? "github" : "list",
	use: {
		...devices["Desktop Chrome"],
		baseURL: "http://localhost:4173",
		viewport: { width: 1440, height: 900 },
		locale: "ko-KR",
		timezoneId: "UTC",
		trace: "retain-on-failure",
	},
	webServer: [
		{
			command: "pnpm exec vite --config testing/e2e/vite.config.ts --port 4173 --strictPort",
			cwd: root,
			url: "http://localhost:4173/",
			reuseExistingServer: false,
			env: { E2E_SCHEMA: "monti_e2e", VITE_CONFIG_NATIVE_IGNORE_WARNING: "true" },
		},
	],
});
