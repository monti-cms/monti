import path from "node:path";
import { defineConfig } from "@playwright/test";
import { shared } from "./shared";

const here = import.meta.dirname;

// The baselines come from Linux. On another system every text edge differs, so a run there would only report noise: say so instead.
if (process.platform !== "linux" && !process.env.MONTI_VISUAL_BASELINES)
	throw new Error(
		"The visual baselines are made on Linux. Run `pnpm test:visual:docker` here (or set MONTI_VISUAL_BASELINES to write to a folder of your own).",
	);

/**
 * Visual regression of the design system's catalog: every story in light and dark, compared with the PNGs under `baselines/`.
 * The baselines are made on the Linux image CI runs in (`pnpm test:visual:docker`), never on a developer's machine: text is drawn
 * differently per operating system, so a shot taken elsewhere would never match.
 */
export default defineConfig({
	...shared,
	testMatch: "shots.spec.ts",
	// `MONTI_VISUAL_BASELINES` points the baselines elsewhere (the Docker run writes them to a mounted folder).
	snapshotPathTemplate: `${process.env.MONTI_VISUAL_BASELINES ?? path.join(here, "baselines")}/{arg}{ext}`,
	reporter: process.env.CI
		? [["list"], ["html", { outputFolder: path.join(here, "report"), open: "never" }]]
		: [["list"]],
	workers: process.env.CI ? 4 : undefined,
	expect: {
		toHaveScreenshot: {
			animations: "disabled",
			caret: "hide",
			// Sub-pixel anti-aliasing noise passes; a moved edge or a changed color does not.
			maxDiffPixelRatio: 0.002,
			threshold: 0.2,
		},
	},
});
