import path from "node:path";
import { packageTests } from "../../vitest.shared";
import { configSensitiveTests } from "../core/test/config-sensitive";

/**
 * Regression guard: reruns the config-sensitive admin UI tests with a config whose collections, fields, languages and blocks differ from the reference blog (`../core/test/other-site.config.ts`).
 *
 * Which tests run: only those that read the site config (`any-site`, `testConfig`, or the config-derived lookups of `testSite` such as `COLLECTIONS` and `schemaOf`;
 * the exact rule is `READS_CONFIG` in `../core/test/config-sensitive.ts`). A test that only renders with `testSite` and names no collection, field or block
 * gives the same result under any config, and the default run covers it. A new test joins by itself once it reads the config that way.
 * Of those, the tests that use the reference blog config's collections, fields, blocks and languages as-is (post, tag, summary, callout, ko/ja...) are skipped below.
 */
const BLOG_FIXTURE_TESTS = [
	// Renders screens with the reference blog's collections and fields (post, memo, category, tag, collection, summary) and its Korean and Japanese translations.
	"src/screens/__test__/entry-list-screen.test.tsx",
	"src/screens/__test__/admin-entries-table.test.tsx",
	"src/screens/__test__/admin-list-rows.test.tsx",
	"src/screens/__test__/list-menus.test.tsx",
	"src/screens/__test__/list-row-menu.test.ts",
	"src/screens/__test__/list-state.test.ts",
	"src/screens/__test__/record-panel.test.tsx",
	"src/screens/entries/__test__/backlink-input.test.tsx",
	"src/screens/entries/__test__/bulk-bar.test.tsx",
	"src/screens/entries/__test__/custom-field-input.test.tsx",
	"src/screens/entries/__test__/entry-editor-shell.test.tsx",
	"src/screens/entries/__test__/entry-form.test.ts",
	"src/screens/entries/__test__/entry-editor-store.test.ts",
	"src/screens/entries/__test__/entry-form-removed.test.ts",
	"src/screens/entries/__test__/schema-fields-form.test.tsx",
	"src/screens/entries/__test__/use-entry-editor.test.tsx",
	"src/screens/entries/__test__/use-field.test.tsx",
	"src/editor/__test__/m13-accessibility.test.tsx",
	"src/editor/internal-link.test.ts",
	// Exercises the editor with the reference blog's blocks (callout, fold, tabs, columns, Mermaid) and the example user blocks (notice, embed).
	"src/editor/__test__/converters.test.ts",
	"src/editor/__test__/custom-block-menu.test.tsx",
	"src/editor/__test__/slash-and-tooltip.test.ts",
	"src/editor/__test__/tiptap-content.test.ts",
	"src/editor/drag/__test__/block-refine.test.ts",
	"src/editor/drag/__test__/drag-commands.test.ts",
	"src/editor/blocks/added/__test__/containers.test.ts",
	"src/editor/blocks/added/__test__/custom-block-view.test.tsx",
	"src/editor/blocks/added/__test__/custom-blocks.test.ts",
	// A custom tabs view over the reference blog's tabs block (children, min and max).
	"src/editor/blocks/__test__/use-block-editor.test.tsx",
	// Linking body text to code needs text decorations that point at code lines (the block extension's code link). When absent, see `code-link-absent.test.ts`.
	"src/editor/code-block/__test__/code-link.test.ts",
	"src/editor/code-block/__test__/anchor-dedupe.test.ts",
];

export default packageTests({
	dir: import.meta.dirname,
	name: "admin",
	site: "other-site",
	environment: "jsdom",
	dom: true,
	include: configSensitiveTests({
		packageDir: import.meta.dirname,
		siteFile: path.resolve(import.meta.dirname, "../core/test/site.ts"),
		// The admin helpers (`src/test/*`) render with `testSite` for every test, so following them would select all tests.
		transitive: false,
		// These hand `testSite` to a component that reads the config (the schema screen, link targets) without naming a collection themselves.
		also: [
			"src/screens/schema/__test__/schema-screen.test.tsx",
			"src/editor/__test__/internal-link-display.test.tsx",
			"src/editor/__test__/internal-link-search.test.tsx",
		],
		skip: (file) =>
			BLOG_FIXTURE_TESTS.includes(
				path
					.relative(import.meta.dirname, file)
					.split(path.sep)
					.join("/"),
			),
	}),
});
