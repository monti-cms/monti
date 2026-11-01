import { packageTests } from "../../vitest.shared";

/**
 * The L3 tests of ui that need a real browser (`*.browser.test.ts(x)`): pointer drags, focus moves and the measuring of the visual checks. They run in Chromium; the rest of L3 runs in
 * jsdom (`vitest.dom.config.ts`).
 */
export default packageTests({
	dir: import.meta.dirname,
	name: "ui",
	layer: "browser",
	dom: true,
});
