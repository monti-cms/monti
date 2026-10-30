import { packageTests } from "../../vitest.shared";

/** The L1 tests of admin: they need only the code, so they run without a DOM. `vitest.dom.config.ts` runs the L3 files (`*.dom.test.ts(x)`). */
export default packageTests({
	dir: import.meta.dirname,
	name: "admin",
});
