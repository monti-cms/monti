import { packageTests } from "../../vitest.shared";

/**
 * Regression guard: re-runs the AI plugin tests with a config whose collections, fields, languages and blocks differ from the reference blog (`test/other-site.config.ts`, AI actions also
 * attach to that site's field names). New tests join this suite automatically. Actions and fields are found from the config
 * (e.g. `src/__test__/any-site.test.ts`). Only tests that use the reference blog config's action names (slug, summary, tags...), collections, blocks, or Korean source text as-is
 * are excluded below.
 */
const BLOG_FIXTURE_TESTS = [
	// Uses the blog config's action keys (slug, summary, tags, category, codeFold...) and the shared style guide text as-is.
	"src/__test__/action.test.ts",
	"src/__test__/plugin.test.ts",
	"src/__test__/run-route.test.ts",
	"src/__test__/run.test.ts",
	"src/__test__/settings.test.ts",
	"src/__test__/shared-route.test.ts",
	"src/__test__/shared.test.ts",
	"src/__test__/store.test.ts",
	// Uses the blog blocks (callout, Mermaid, etc.), Korean source text, and several languages.
	"src/__test__/custom.test.ts",
	"src/admin/__test__/ai-test-sample.test.tsx",
	"src/admin/__test__/ai-translate.test.ts",
];

export default packageTests({
	dir: import.meta.dirname,
	name: "ai",
	site: "other-site",
	dom: true,
	exclude: BLOG_FIXTURE_TESTS,
});
