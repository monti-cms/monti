import { defineConfig } from "@playwright/test";
import { shared } from "./shared";

/**
 * The audit: the automated checks over every story, in light and dark, with no shot compared (`pnpm test:visual:audit`). Text is not drawn
 * differently enough per system to matter here, so unlike the shots it runs anywhere.
 */
export default defineConfig({
	...shared,
	testMatch: "audit.spec.ts",
	reporter: [["list"]],
	workers: process.env.CI ? 4 : undefined,
});
