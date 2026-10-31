import { packageTests } from "../../vitest.shared";

/**
 * The admin suite as mutation testing runs it (`stryker.config.mjs`): the L1 and L3 files in one project, in jsdom, since a mutant is caught by
 * whichever test reaches it.
 */
export default packageTests({
	dir: import.meta.dirname,
	name: "admin",
	environment: "jsdom",
	dom: true,
	include: ["src/**/*.{test,spec}.{ts,tsx}"],
});
