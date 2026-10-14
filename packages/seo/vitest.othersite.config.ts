import { packageTests } from "../../vitest.shared";

/**
 * Regression guard: reruns the SEO extension tests with a config (`test/other-site.config.ts`) whose SEO field names, tab and language differ from the example blog.
 * Fields are found by role in the config. Only tests that use the example blog config's field names as they are are excluded below.
 */
const BLOG_FIXTURE_TESTS = ["src/__test__/blog-seo.test.ts"];

export default packageTests({
	dir: import.meta.dirname,
	name: "seo",
	site: "other-site",
	environment: "jsdom",
	dom: true,
	exclude: BLOG_FIXTURE_TESTS,
});
