import { packageTests } from "../../vitest.shared";
import { otherSiteTests } from "./vitest.othersite.config";

/** Regression guard: reruns the config-sensitive browser tests (`*.browser.test.tsx`) with the other-site config; `vitest.othersite.config.ts` explains which. */
export default packageTests({
	dir: import.meta.dirname,
	name: "admin",
	site: "other-site",
	layer: "browser",
	dom: true,
	include: otherSiteTests.filter((file) => /\.browser\.test\.tsx?$/.test(file)),
});
