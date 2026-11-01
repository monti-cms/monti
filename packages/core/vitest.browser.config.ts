import { createRequire } from "node:module";
import path from "node:path";
import { packageTests } from "../../vitest.shared";

const require = createRequire(import.meta.url);

/**
 * The L3 tests of core that need a real browser (`*.browser.test.ts`): the looks of the public stylesheet (`render.css`), read as computed styles
 * in Chromium. `vitest.config.ts` runs L1, `vitest.int.config.ts` L2.
 */
export default packageTests({
	dir: import.meta.dirname,
	name: "core",
	layer: "browser",
	commands: {
		/** `render.css` compiled the way a site's Tailwind input takes it (`examples/blog/app/globals.css`): after Tailwind, with typography. */
		renderCss: async () => {
			const postcss = require("postcss") as typeof import("postcss");
			const tailwind = require("@tailwindcss/postcss") as typeof import("@tailwindcss/postcss");
			const from = path.join(import.meta.dirname, "render-css-site.css");
			const input = [
				'@import "tailwindcss" source(none);',
				'@import "./render.css";',
				'@plugin "@tailwindcss/typography";',
				'@source inline("prose");',
			].join("\n");
			return (await postcss([tailwind({ optimize: false })]).process(input, { from })).css;
		},
		/** The system's light or dark setting (`prefers-color-scheme`), for the page under test. */
		colorScheme: async ({ page }, scheme: "light" | "dark") => {
			await page.emulateMedia({ colorScheme: scheme });
		},
	},
});
