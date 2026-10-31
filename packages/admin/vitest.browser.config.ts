import path from "node:path";
import { type PackageTestsOptions, packageTests } from "../../vitest.shared";

/** What both browser projects of admin share (this one and `vitest.othersite-browser.config.ts`). */
export const browserTests = {
	dir: import.meta.dirname,
	name: "admin",
	layer: "browser",
	dom: true,
	// The fake API checks its routes against the core router, which cannot load in a browser: there the check runs after each test, in Node.
	alias: [
		{ find: /^\.\/core-routes$/, replacement: path.join(import.meta.dirname, "src/test/core-routes.browser.ts") },
	],
	commands: {
		coreRouteProblems: async ({ project }, routes: readonly string[]) => {
			const { coreRouteProblem } = await project.import<typeof import("./src/test/core-routes")>(
				path.join(import.meta.dirname, "src/test/core-routes.ts"),
			);
			return routes.map(coreRouteProblem).filter((problem) => problem !== undefined);
		},
	},
} satisfies PackageTestsOptions;

/**
 * The L3 tests of admin that need a real browser (`*.browser.test.ts(x)`): layout, positions, focus moves and the editor. They run in Chromium; the
 * rest of L3 runs in jsdom (`vitest.dom.config.ts`).
 */
export default packageTests(browserTests);
