import { packageTests } from "../../vitest.shared";

/**
 * Reruns the tests that need the Shiki notation extension in the site config (`test/shiki.config.ts`): the extension reaches the parser
 * and the public render chain through `mdx.syntax`, not through an explicit list. Only `*.configured.test.ts` runs here.
 */
export default packageTests({
	dir: import.meta.dirname,
	name: "syntax-shiki",
	site: "configured",
	include: ["src/**/*.configured.test.{ts,tsx}"],
});
