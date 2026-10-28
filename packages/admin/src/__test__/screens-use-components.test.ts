// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Screens are built from `@monti-cms/ui` components and their options only: no `className`, no `style`, and no import of the open entry
 * (`@monti-cms/ui/internal`). The components already refuse `className` and `style` in their types; this test also covers raw elements.
 * The files below draw something the components cannot say (positions over the document, drag transforms, measured layouts, chart
 * geometry, an imitation of another site), and each is listed with the reason. Adding a file here is a design decision, made in review.
 */
const DRAWING = new Map<string, string>([
	["admin/src/editor/block-handle-overlay.tsx", "the handle floats beside the block at measured coordinates"],
	[
		"admin/src/editor/blocks/added/view.tsx",
		"the default custom block is drawn in the document: a frame with the component name above its body",
	],
	[
		"admin/src/editor/blocks/block-issues.tsx",
		"a notice under a block inside the document; block views stay free of UI packages",
	],
	[
		"admin/src/editor/blocks/fence-preview/fence-preview-node-view.tsx",
		"the preview block is drawn inside the document",
	],
	[
		"admin/src/editor/blocks/fence-preview/preview-renderers.tsx",
		"rendered previews (diagram, formula) are drawn inside the document in the block's own look",
	],
	[
		"admin/src/editor/blocks/shared.tsx",
		"the block toolbar floats over the block corner and attributes are written in place inside the block",
	],
	[
		"admin/src/editor/blocks/use-block-editor.tsx",
		"`Content` and `BlockFrame` are how a block view draws inside the document, so they take a `className`",
	],
	[
		"admin/src/editor/code-block/code-block-view.tsx",
		"the code block is drawn in the document: frame, line gutter, line backgrounds and the code text are positioned together",
	],
	[
		"admin/src/editor/code-block/line-menu.tsx",
		"a menu beside the picked lines (absolute position inside the block, never takes focus from the code)",
	],
	[
		"admin/src/editor/file-node-view.tsx",
		"the file card is a block inside the document, with its name written in place",
	],
	[
		"admin/src/editor/image-crop-sheet.tsx",
		"the crop area is the image with a rectangle, mask and handles positioned by percent and pointer drag",
	],
	[
		"admin/src/editor/image-node-view.tsx",
		"the image block is drawn inside the document: frame, crop, width, caption in place, resize handles",
	],
	[
		"admin/src/editor/inline-bubble.tsx",
		"the bubble floats at the selection (fixed coordinates, z-index, measured by ref)",
	],
	[
		"admin/src/editor/internal-link-popup.tsx",
		"a list floating at the caret (fixed coordinates, z-index, highlighted row scrolled into view)",
	],
	["admin/src/editor/table-toolbar.tsx", "the toolbar floats over the table at a position measured from it"],
	[
		"admin/src/editor/tiptap-editor.tsx",
		"the editor canvas: the writing column is sized by `--editor-width`, and the empty-line hint and the block under an open menu are styled inside it",
	],
	["admin/src/host/layout.tsx", "the admin root: `monti-admin` scopes the tokens and the page fills the window"],
	[
		"admin/src/host/setup-problem.tsx",
		"the admin root: `monti-admin` scopes the tokens and the screen is centered in the window",
	],
	[
		"admin/src/screens/entries/editor-scroller.tsx",
		"the scrolling body of the editor: its active-block highlight reaches into the editor's own markup",
	],
	[
		"admin/src/screens/entries/entry-editor-side-panels.tsx",
		"the side panels overlay the body on narrow screens and dock beside it on wide ones (absolute position, shadow)",
	],
	[
		"admin/src/screens/entries/scroll-room.tsx",
		"extra room after the last block so the source can scroll as far as the translation does (35% of the viewport, in step with the editor)",
	],
	[
		"admin/src/screens/entries/sortable-entry-row.tsx",
		"a sortable row is moved by dnd-kit's transform (inline style) and lifts while dragged, and its handle needs a grab cursor and no touch scrolling",
	],
	[
		"admin/src/screens/schema/fields-tree-layout-rows.tsx",
		"the field list tab and group rows: drag transform, hover-revealed handle",
	],
	[
		"admin/src/screens/schema/fields-tree-rows.tsx",
		"the field list rows: column grid, hover-revealed handle and buttons, kind colours, drag transform",
	],
	[
		"admin/src/screens/schema/fields-tree.tsx",
		"the field list frame: column grid, resizable side panel and preview column",
	],
	[
		"admin/src/screens/shared/side-panel.tsx",
		"the slots of the side panels: beside the list or the page on a wide window, floating over its right edge on a narrow one (absolute position, shadow)",
	],
	["blocks/src/callout/view.tsx", "draws the callout as the public post does"],
	["blocks/src/chart/preview.tsx", "chart geometry inside the post's rhythm"],
	["blocks/src/chart/ui.tsx", "chart geometry (recharts selectors, aspect ratio, tooltip and legend boxes, swatches)"],
	["blocks/src/chart/view.tsx", "the public page's chart, styled by render.css"],
	["blocks/src/code-explorer/view.tsx", "draws the explorer as the public post does"],
	["blocks/src/collapsible/view.tsx", "draws the collapsible as the public post does"],
	["blocks/src/color/menu.tsx", "color samples painted by the mark's own classes and variables"],
	["blocks/src/columns/view.tsx", "measured column layout with boundary handles and drag"],
	["blocks/src/mermaid/preview.tsx", "hosts the diagram SVG"],
	["blocks/src/tabs/view.tsx", "draws the tab bar and body as the public post does"],
	["mdx/src/admin/mdx-source-editor.tsx", "a textarea laid over a syntax-highlighted layer"],
	["mdx/src/admin/source-panel.tsx", "sizes the highlighted source editor, which draws its own surface"],
]);

const packagesDir = path.resolve(__dirname, "../../..");
/** The packages whose sources the admin stylesheet compiles (its `@source` lines), minus the design system itself. */
const SCREEN_PACKAGES = [
	...readFileSync(path.resolve(__dirname, "../../styles/index.css"), "utf8").matchAll(
		/^@source "(?:\.\.\/\.\.\/)?([\w-]+|\.\.)\/src";/gm,
	),
]
	.map((m) => (m[1] === ".." ? "admin" : m[1]))
	.filter((name) => name !== "ui");

/** Not screens: the admin's own design-system parts, stories and tests, and the blocks' public-site renderers (styled by `render.css`). */
const isScreen = (file: string) =>
	!file.startsWith("admin/src/ui/") &&
	!file.startsWith("admin/src/stories/") &&
	!/\.stories\.tsx$/.test(file) &&
	!/\/render(\.client)?\.tsx$/.test(file);

function sourceFiles(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory())
			return ["__test__", "node_modules", "dist", "test"].includes(entry.name) ? [] : sourceFiles(full);
		return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : [];
	});
}

const screens = SCREEN_PACKAGES.flatMap((name) => sourceFiles(path.join(packagesDir, name, "src")))
	.map((full) => ({ file: path.relative(packagesDir, full), source: readFileSync(full, "utf8") }))
	.filter(({ file }) => isScreen(file));

function linesMatching(source: string, pattern: RegExp): number[] {
	return source.split("\n").flatMap((text, index) => (pattern.test(text) ? [index + 1] : []));
}

describe("screens use components only", () => {
	it("no screen sets className or style", () => {
		const offenders = screens
			.filter(({ file }) => !DRAWING.has(file))
			.flatMap(({ file, source }) =>
				linesMatching(source, /\b(?:className|style)=\{?["'`{]/).map((line) => `${file}:${line}`),
			);
		expect(offenders).toEqual([]);
	});

	it("only drawing files import the open entry", () => {
		const offenders = screens
			.filter(({ file }) => !DRAWING.has(file))
			.flatMap(({ file, source }) =>
				linesMatching(source, /from "@monti-cms\/ui\/internal"/).map((line) => `${file}:${line}`),
			);
		expect(offenders).toEqual([]);
	});

	it("only drawing files import the class helpers (cn, *Variants)", () => {
		const offenders = screens
			.filter(({ file }) => !DRAWING.has(file))
			.filter(({ source }) =>
				/import (?:type )?\{[^}]*\b(?:cn|[a-z]+Variants)\b[^}]*\} from "@monti-cms\/(?:ui|admin|admin\/kit)"/.test(
					source,
				),
			)
			.map(({ file }) => file);
		expect(offenders).toEqual([]);
	});

	it("every drawing file exists and still draws", () => {
		const byFile = new Map(screens.map(({ file, source }) => [file, source]));
		const stale = [...DRAWING.keys()].filter((file) => {
			const source = byFile.get(file);
			return source === undefined || !/\b(?:className|style)=|@monti-cms\/ui\/internal/.test(source);
		});
		expect(stale).toEqual([]);
	});
});
