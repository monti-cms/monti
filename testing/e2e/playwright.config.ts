import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";
import { LIVE, SERVERS } from "./servers";

const app = fileURLToPath(new URL("../../examples/blog", import.meta.url));

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
		baseURL: LIVE,
		viewport: { width: 1440, height: 900 },
		locale: "ko-KR",
		timezoneId: "UTC",
		trace: "retain-on-failure",
	},
	// `testing/e2e/prepare.ts` made the databases and built the app (`pnpm test:e2e` runs it first): these only serve.
	webServer: SERVERS.map((server) => ({
		command:
			server.mode === "start"
				? `pnpm exec next start --port ${server.port}`
				: `pnpm exec next dev --port ${server.port}`,
		cwd: app,
		url: `http://localhost:${server.port}/admin`,
		reuseExistingServer: false,
		timeout: 120_000,
		env: { ...server.env, NEXT_DIST_DIR: server.dist },
	})),
});
