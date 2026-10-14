import { packageTests } from "../../vitest.shared";

/**
 * Regression guard: reruns the directive tests with a config whose blocks differ from the reference blog (`test/other-site.config.ts`).
 * Block names are looked up from the config. Tests that read the reference blog's sample posts (callouts, tabs, tooltips) live in
 * `*.blog.test.ts` and are excluded here.
 */
const BLOG_FIXTURE_TESTS = ["src/**/*.blog.test.ts", "src/**/*.configured.test.{ts,tsx}"];

export default packageTests({
	dir: import.meta.dirname,
	name: "syntax-directive",
	site: "other-site",
	exclude: BLOG_FIXTURE_TESTS,
});
