import { packageTests } from "../../vitest.shared";

/** The L3 tests of ui (`*.dom.test.tsx`): the parts rendered in jsdom, found by role and name. `vitest.config.ts` runs the rest. */
export default packageTests({
	dir: import.meta.dirname,
	name: "ui",
	layer: "dom",
	environment: "jsdom",
	dom: true,
});
