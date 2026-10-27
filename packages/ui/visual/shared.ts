import path from "node:path";
import type { PlaywrightTestConfig } from "@playwright/test";
import { STORYBOOK_DIR } from "./paths";

const here = import.meta.dirname;
const PORT = Number(process.env.MONTI_VISUAL_PORT ?? 6188);

/** What the shots and the audit share: the folders, the browser window and the static server of the built Storybook. */
export const shared = {
	testDir: here,
	outputDir: path.join(here, "test-results"),
	fullyParallel: true,
	retries: 0,
	timeout: 30_000,
	use: {
		baseURL: `http://localhost:${PORT}`,
		viewport: { width: 1280, height: 720 },
		deviceScaleFactor: 1,
		colorScheme: "light",
		locale: "en-US",
		timezoneId: "UTC",
		reducedMotion: "reduce",
	},
	webServer: {
		command: `pnpm exec vite preview --outDir ${STORYBOOK_DIR} --port ${PORT} --strictPort`,
		cwd: path.resolve(here, ".."),
		url: `http://localhost:${PORT}/iframe.html`,
		reuseExistingServer: !process.env.CI,
		timeout: 60_000,
	},
} satisfies PlaywrightTestConfig;
