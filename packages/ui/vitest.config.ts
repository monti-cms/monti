import { packageTests } from "../../vitest.shared";

/**
 * The L1 tests of ui: the code alone (`cn`, the shortcut text, the decisions of the visual checks and story picking). `vitest.dom.config.ts`
 * runs the parts rendered in jsdom (`*.dom.test.tsx`), `vitest.browser.config.ts` the ones that need a real browser (`*.browser.test.tsx`).
 */
export default packageTests({
	dir: import.meta.dirname,
	name: "ui",
	dom: true,
});
