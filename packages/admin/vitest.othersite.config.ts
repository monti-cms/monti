import path from "node:path";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

/**
 * Regression guard: reruns the admin UI tests with a config whose collections, fields, languages and blocks differ from the reference blog (`../core/test/other-site.config.ts`).
 * New tests join this bundle automatically. Collections, fields and blocks are looked up from the config
 * (e.g. `src/screens/__test__/any-site-screens.test.tsx`, `src/editor/__test__/any-site-blocks.test.ts`).
 * Only tests that use the reference blog config's collections, fields, blocks and languages as-is (post, tag, summary, callout, ko/ja...) are excluded below.
 */
const BLOG_FIXTURE_TESTS = [
	// Renders screens with the reference blog's collections and fields (post, memo, category, tag, collection, summary) and its Korean and Japanese translations.
	"src/screens/__test__/admin-dashboard.test.tsx",
	"src/screens/__test__/admin-entries-table.test.tsx",
	"src/screens/__test__/blog-list-defaults.test.ts",
	"src/screens/__test__/list-row-menu.test.ts",
	"src/screens/__test__/list-state.test.ts",
	"src/screens/__test__/record-panel.test.tsx",
	"src/screens/entries/__test__/backlink-input.test.tsx",
	"src/screens/entries/__test__/bulk-bar.test.tsx",
	"src/screens/entries/__test__/custom-field-input.test.tsx",
	"src/screens/entries/__test__/entry-editor-shell.test.tsx",
	"src/screens/entries/__test__/entry-form.test.ts",
	"src/screens/entries/__test__/entry-form-removed.test.ts",
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
	// Linking body text to code needs text decorations that point at code lines (the block extension's code link). When absent, see `code-link-absent.test.ts`.
	"src/editor/code-block/__test__/code-link.test.ts",
	"src/editor/code-block/__test__/anchor-dedupe.test.ts",
];

export default defineConfig(({ mode }) => ({
	test: {
		name: "admin (other-site)",
		environment: "jsdom",
		globals: true,
		include: ["src/**/*.{test,spec}.{ts,tsx}"],
		exclude: BLOG_FIXTURE_TESTS,
		setupFiles: ["./src/test/setup-dom.ts"],
		sequence: { groupOrder: 2 },
		testTimeout: 60000,
		hookTimeout: 60000,
		env: {
			...loadEnv(mode, path.resolve(__dirname, "../.."), ""),
			...loadEnv(mode, __dirname, ""),
			TZ: "UTC",
		},
	},
	resolve: {
		alias: {
			"@cms-config": path.resolve(__dirname, "../core/test/other-site.config.ts"),
			"server-only": path.resolve(__dirname, "../core/test/server-only.ts"),
		},
	},
}));
