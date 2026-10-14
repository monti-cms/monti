import { packageTests } from "../../vitest.shared";

/**
 * Reruns the tests that need the directive extension in the site config (`test/directive.config.ts`): the extension reaches the parser,
 * the serializer and the public render chain through `mdx.syntax`, not through an explicit list. Only `*.configured.test.ts` runs here.
 */
export default packageTests({
	dir: import.meta.dirname,
	name: "syntax-directive",
	site: "configured",
	include: ["src/**/*.configured.test.{ts,tsx}"],
});
