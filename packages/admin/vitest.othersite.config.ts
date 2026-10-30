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
	"src/screens/__test__/entry-list-screen.dom.test.tsx",
	"src/screens/__test__/admin-entries-table.dom.test.tsx",
	"src/screens/__test__/admin-list-rows.dom.test.tsx",
	"src/screens/__test__/list-column-menu.test.ts",
	"src/screens/__test__/list-menus.dom.test.tsx",
	"src/screens/__test__/list-row-menu.test.ts",
	"src/screens/__test__/list-state.test.ts",
	"src/screens/__test__/record-panel.dom.test.tsx",
	"src/screens/entries/__test__/backlink-input.dom.test.tsx",
	"src/screens/entries/__test__/bulk-bar.dom.test.tsx",
	"src/screens/entries/__test__/custom-field-input.dom.test.tsx",
	"src/screens/entries/__test__/entry-editor-shell.dom.test.tsx",
	"src/screens/entries/__test__/entry-form.test.ts",
	"src/screens/entries/__test__/entry-editor-store.test.ts",
	"src/screens/entries/__test__/entry-form-removed.test.ts",
	"src/screens/entries/__test__/use-entry-editor.dom.test.tsx",
	"src/screens/entries/__test__/use-field.dom.test.tsx",
	"src/editor/__test__/m13-accessibility.dom.test.tsx",
	"src/editor/internal-link.dom.test.ts",
	// Exercises the editor with the reference blog's blocks (callout, fold, tabs, columns, Mermaid) and the example user blocks (notice, embed).
	"src/editor/__test__/converters.test.ts",
	"src/editor/__test__/slash-and-tooltip.dom.test.ts",
	"src/editor/__test__/tiptap-content.test.ts",
	"src/editor/drag/__test__/block-refine.dom.test.ts",
	"src/editor/drag/__test__/drag-commands.dom.test.ts",
	"src/editor/blocks/added/__test__/containers.dom.test.ts",
	"src/editor/blocks/added/__test__/custom-block-view.dom.test.tsx",
	"src/editor/blocks/added/__test__/custom-blocks.test.ts",
	// A custom tabs view over the reference blog's tabs block (children, min and max).
	"src/editor/blocks/__test__/use-block-editor.dom.test.tsx",
	// Linking body text to code needs text decorations that point at code lines (the block extension's code link). When absent, see `code-link-absent.test.ts`.
	"src/editor/code-block/__test__/code-link.dom.test.ts",
	"src/editor/code-block/__test__/anchor-dedupe.dom.test.ts",
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
			"src/editor/__test__/internal-link-display.dom.test.tsx",
			"src/editor/__test__/internal-link-search.dom.test.tsx",
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
