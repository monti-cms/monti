# @monti-cms/blocks

English | [한국어](README.ko.md)

Block extensions for `@monti-cms/core`. Install only the body blocks and inline marks you need, as plugins.

| Block | Plugin | Stored syntax | Public page component |
| --- | --- | --- | --- |
| Callout | `callout()` | `<Callout variant="tip" title="…">…</Callout>` | `Callout` |
| Collapsible | `collapsible()` | `<Collapsible title="…">…</Collapsible>` | `Collapsible` |
| Tabs | `tabs()` | 2 to 8 `<Tab label="…">` inside `<Tabs>` | `Tabs`, `Tab` |
| Columns | `columns()` | 2 to 4 `<Column>` inside `<Columns widths="60,40">` | `Columns`, `Column` |
| Code explorer | `codeExplorer()` | ` ```ts title="src/app/page.tsx" ` code fences inside `<CodeExplorer open="src/app/page.tsx">` | `CodeExplorer` |
| Mermaid | `mermaid()` | ` ```mermaid ` | `Mermaid` |
| Chart | `chart()` | ` ```chart ` | `Chart` |
| Tooltip | `tooltip()` | `<Tooltip content="description">text</Tooltip>` | `Tooltip` |
| Code link | `codeRef()` | `<CodeRef to="c1">text</CodeRef>` (code line label `// @line anchor {..} id="c1"`) | `CodeRef` |
| Text color | `color({ palette? })` | `<Color fg="#…" fgDark="#…" bg="#…" bgDark="#…">text</Color>` | `Color` |

Stored as standard MDX (JSX elements). Sites that use the directive notation (`:::callout{…}`, `:tooltip[text]{…}`) read and write it by adding `directiveSyntax()` from `@monti-cms/syntax-directive` to `mdx({ syntax })` of `@monti-cms/mdx` in the config `plugins`.

## Installation

```ts
// cms.config.ts
import { blocks } from "@monti-cms/blocks";

export default defineConfig({
	// …
	plugins: [
		...blocks(), // all of them (callout, collapsible, tabs, columns, code explorer, Mermaid, chart, tooltip, code link, text color)
		// ...blocks({ only: ["callout", "tooltip"] })   only the chosen ones
		// ...blocks({ omit: ["chart"], codeRef: false }) leave some out (`false` also leaves one out)
		// ...blocks({ color: { palette: [...] } })       per-extension options
	],
});
```

You can also add them one by one (`plugins: [callout(), columns(), color({ palette })]`). Adding the same extension twice is a config error.

Two stylesheets, neither needing Tailwind in the app:

```tsx
// the admin layout: the edit screens of the blocks (prebuilt, scoped to the admin; built like the admin's, see "Styles" in the `@monti-cms/admin` README)
import "@monti-cms/admin/styles.css";
import "@monti-cms/blocks/styles.css";
```

```css
/* the site's global CSS: the default public components (`cms-block-*`), the text color rule and the default callout and chart colors */
@import "@monti-cms/blocks/render.css";
```

- Code explorer: a file tree with the code of the picked file, for posts that show several files of a project. It holds plain code fences and each fence's `title` is its path,
  so the tree is built from the paths and never drawn by hand. A fence with a title and no code is a file shown only in the tree, a title ending in `/` is a folder, and `open` names the file shown first
  (the first file if omitted). Every file stays an ordinary code block (line effects, folding, copy and code links work), and every file is in the page's HTML (only hidden on screen), so readers without JavaScript,
  feeds and search engines see titled code blocks one after another. Directive notation: `:::code-explorer{open="src/app/page.tsx"}` with the fences inside.
  Editor: the block shows its files as a list (click a path to move the cursor into that file; the file with the cursor is marked) above the code blocks, which are edited in place
  (the path is the code block's own title field). The block toolbar adds a file (`src/new-file.ts`, numbered if taken) or a folder, picks the file shown first, and deletes the block.
  The slash menu inserts the block with one `src/index.ts` code block.
- Editor: callout, collapsible, tabs, columns and the code explorer come with their edit screens (admin theme colors, `styles.css`). Mermaid and chart are
  edited with a code input and a preview. The preview is drawn by this extension (the app installs the optional dependencies `mermaid` and `recharts`, which are loaded only when a preview opens),
  and if the site registers the same name through `fencePreviews` (`@monti-cms/admin`), that one wins. Chart colors are the CSS variables `--chart-1` to `--chart-5`,
  and if the app does not set them, the defaults in `render.css` apply (the editor preview takes the app's `--chart-N` too, with the same defaults, as `--cms-chart-N`).
- Inline marks: the tooltip is offered in the formatting toolbar (after link), the text bubble and the slash menu; text color in the formatting toolbar (after inline marks) and the text bubble; and the code link in the text bubble
  (when the document has a code block) plus description, relink and unlink for the link at the cursor (see "Text marks" in the `@monti-cms/admin` README).
  Code line labels, the "Link to body" item in the code block line menu, the linking hint line and the highlight of the hovered line are core code block features, and they use this mark through this extension's
  `to` attribute (`codeAnchor`). The in-code tooltip (`// @char Tooltip`) is a core code block feature.
- Code link on public pages: a label is unique per document and a link resolves to exactly one code block (the first one with that label). Hovering or focusing the text highlights the linked lines;
  while they are off screen it also shows a small preview of them (up to 8 lines and the code block title) next to the text (`role="tooltip"`, hidden on leave, blur or Esc), and pressing scrolls to them.
  The first text that points to a label adds a back-link button (`↩`) at the end of the first linked line, which scrolls back to that text and highlights it briefly (`data-focused`).
- The text color picker list is `color({ palette })` (the default 8 colors `defaultTextPalette(t)` if omitted). The body stores hex values, so changing the list leaves
  already written text as it is. Public pages render with `cleanTextColor` and `textColorProps` from `@monti-cms/blocks/color`, and the color is
  chosen to match the theme by `.cms-color` in `render.css` (the editor has the same rule in `styles.css`).
- Public pages: each extension provides default public components (the plugin `render`, which returns `{ documentComponents }`; `renderDocument` and `CmsContent` of `@monti-cms/core/render` use it automatically).
  Only the parts that run in the browser (tab switching, tooltip, code link, Mermaid, chart) are split into `"use client"` files. Mermaid and chart render only when the app installs the optional dependencies
  `mermaid` and `recharts` (on the server and before loading, the source text is shown), and the callout default title, collapsible
  default title and chart error messages follow the site language (`locale`). The look is the `cms-block-*` classes in `render.css` (no Tailwind needed). Code fence blocks (`mermaid`, `chart`) get their code as `source`. Column widths are read with `parseColumnWidths` and `columnsGridTemplate` from `@monti-cms/blocks/columns`,
  and chart syntax and size with `parseChartDsl`, `normalizeChartDsl` and `resolvePieGeometry` from `@monti-cms/blocks/chart`.
- Each extension's render module exports only `documentComponents(context)` (the MDX-shaped default export and the MDX component tables are gone), the table `renderDocument` merges in (`blocks` by block name with the attributes as
  flat props, `marks` for `tooltip`, `code-ref` and `color`, and the `Tooltip` code tag). Tabs and the code explorer read their children from the stored nodes (`items`), not from the props of child elements.
  A site overrides one with `renderDocument(doc, { components: { blocks: { callout: … } } })` (or the same `components` option of `CmsContent` and `renderMdx`); the props are typed from the block definitions of the site config.
- Changing the look: the app sets the variables on `:root` (`--cms-callout-note`, `-tip`, `-info`, `-warning`, `-danger`, `--chart-1` to `5`); the defaults in `render.css` and `styles.css` are wrapped in `:where()`, so the app's values win.
- If you remove the plugin of a block that is already used, that block drops out of the stored syntax and turns into plain text the next time it is saved.

To use only the definitions without plugins (for example in tests), put the definitions from `@monti-cms/blocks/definitions` into the config's `blocks`.

## AI features (optional)

On sites that use `@monti-cms/ai`, `mermaid()` and `chart()` add AI features automatically (the plugin's `contributes.ai`). Nothing goes in the config.

| Block | Feature names | Where they attach |
| --- | --- | --- |
| `mermaid()` | `diagramDraft` · `diagramEdit` | Create a diagram (slash menu) · edit (next to the block handle) |
| `chart()` | `chartDraft` · `chartEdit` | Create a chart · edit |

Only to change or turn one off, list it under the same name.

```ts
import { mermaidAi } from "@monti-cms/blocks/mermaid/ai";

aiPlugin({ actions: { diagramDraft: mermaidAi.draft({ prompt: "…" }), chartEdit: false } });
```

The block extensions do not load AI plugin code (they read only its types). On sites without the AI plugin, the contribution is not used.

Both features check the result syntax with code checks (`mermaidSyntax`, `chartSyntax`). The same checks can be used in the `checks` of other features.
For the development-only fake connection (`CMS_AI_FAKE=1`), the feature definition's `fake` returns an answer that passes the syntax check (an example block for create, and the
original block plus one line for edit).
The chart instructions include a chart syntax guide (`chartSyntaxGuide()`). The chart syntax is read by `parseChartDsl` and
`normalizeChartDsl` in `@monti-cms/blocks/chart`. Syntax errors give only the line number, a code (`code`) and values (`values`); the caller builds the text with `chartErrorLine` and the
message dictionary (`chartMessages`) (the text language on public pages, the admin language in the editor).

## Creating a new block

Blocks in this package are made the same way as blocks a site makes: one block definition (`defineBlock`) and, if needed, an edit screen.

```ts
// Definition: stored syntax, attributes, editing mode
export const bannerBlock = defineBlock({ name: "banner", syntax: { kind: "container", directive: "banner" }, … });

// Plugin: the block and the admin side (optional)
export const banner = () =>
	definePlugin({ name: "banner", options: {}, blocks: [bannerBlock], admin: () => import("./banner/admin") });

// banner/admin.ts: a provider that supplies the edit screen (blockViews, built on useBlockEditor and Content)
export default defineAdminPlugin({ Provider: BannerProvider });
```

Without an edit screen, the block is edited with the admin's default box. If the menu icon (`editor.icon`) is not among the admin package's default icons,
register it with `icons` in the provider (all blocks in this package do so). Mark translatable attributes (title, tab name) with `translatable: true`. See "Body blocks" in the `@monti-cms/core` README and
"Block edit screens" in the `@monti-cms/admin` README for details.

## Development

```bash
pnpm --filter @monti-cms/blocks test:run
pnpm --filter @monti-cms/blocks typecheck
```
