import { packageTests } from "../../vitest.shared";
import { browserTests } from "./vitest.browser.config";
import { otherSiteTests } from "./vitest.othersite.config";

/** Regression guard: reruns the config-sensitive browser tests (`*.browser.test.tsx`) with the other-site config; `vitest.othersite.config.ts` explains which. */
export default packageTests({
	...browserTests,
	site: "other-site",
	include: otherSiteTests.filter((file) => /\.browser\.test\.tsx?$/.test(file)),
});
