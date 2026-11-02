import { packageTests } from "../../vitest.shared";

/** The L3 tests of ai (`*.dom.test.ts(x)`): they render the admin parts in jsdom. `vitest.config.ts` runs the rest. */
export default packageTests({
	dir: import.meta.dirname,
	name: "ai",
	layer: "dom",
	environment: "jsdom",
	dom: true,
});
