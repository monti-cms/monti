import { packageTests } from "../../vitest.shared";

/**
 * The L3 tests of admin that need a real browser (`*.browser.test.ts(x)`): layout, positions, focus moves and the editor. They run in Chromium; the
 * rest of L3 runs in jsdom (`vitest.dom.config.ts`).
 */
export default packageTests({
	dir: import.meta.dirname,
	name: "admin",
	layer: "browser",
	dom: true,
});
