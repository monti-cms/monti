import { packageTests } from "../../vitest.shared";

/** The L3 tests of admin (`*.dom.test.ts(x)`): they render components or editors in jsdom. `vitest.config.ts` runs the rest. */
export default packageTests({
	dir: import.meta.dirname,
	name: "admin",
	layer: "dom",
	environment: "jsdom",
	dom: true,
});
