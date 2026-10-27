import { execFileSync } from "node:child_process";
import path from "node:path";
import type { PlaywrightTestConfig } from "@playwright/test";
import { STORYBOOK_DIR } from "./paths";

const here = import.meta.dirname;

/** A port nothing listens on now, asked of the system (a throwaway process, so this file stays synchronous). */
const freePort = () =>
	Number(
		execFileSync(
			process.execPath,
			["-e", "const s=require('node:net').createServer().listen(0,()=>{console.log(s.address().port);s.close()})"],
			{ encoding: "utf8" },
		).trim(),
	);

// Every run serves its own build on its own port, never one that is already served: a second run (another `MONTI_STORYBOOK_DIR`, another
// worktree) must not end up looking at a Storybook that is not the build it names. The port is kept in the environment so the workers, which
// load this file again, agree with the process that starts the server.
process.env.MONTI_VISUAL_PORT ??= String(freePort());
const PORT = Number(process.env.MONTI_VISUAL_PORT);

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
		reuseExistingServer: false,
		timeout: 60_000,
	},
} satisfies PlaywrightTestConfig;
