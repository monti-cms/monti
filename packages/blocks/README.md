# @monti-cms/blocks

English | [한국어](README.ko.md)

Block extensions for `@monti-cms/core`. Install only the body blocks and inline marks you need, as plugins.

| Block | Plugin | Stored syntax | Public page component |
| --- | --- | --- | --- |
| Callout | `callout()` | `<Callout variant="tip" title="…">…</Callout>` | `Callout` |
| Collapsible | `collapsible()` | `<Collapsible title="…">…</Collapsible>` | `Collapsible` |
| Tabs | `tabs()` | 2 to 8 `<Tab label="…">` inside `<Tabs>` | `Tabs`, `Tab` |
| Columns | `columns()` | 2 to 4 `<Column>` inside `<Columns widths="60,40">` | `Columns`, `Column` |
| Mermaid | `mermaid()` | ` ```mermaid ` | `Mermaid` |
| Chart | `chart()` | ` ```chart ` | `Chart` |
| Tooltip | `tooltip()` | `<Tooltip content="description">text</Tooltip>` | `Tooltip` |
| Code link | `codeRef()` | `<CodeRef to="c1">text</CodeRef>` (code line label `// @line anchor {..} id="c1"`) | `CodeRef` |
| Text color | `color({ palette? })` | `<Color fg="#…" fgDark="#…" bg="#…" bgDark="#…">text</Color>` | `Color` |

Stored as standard MDX (JSX elements). Sites that use the directive notation (`:::callout{…}`, `:tooltip[text]{…}`) read and write it by adding `directiveSyntax()` from `@monti-cms/core/syntax` to `mdx.syntax` in the config.

## Installation

```ts
// cms.config.ts
import { blocks } from "@monti-cms/blocks";

export default defineConfig({
	// …
	plugins: [
		...blocks(), // all of them (callout, collapsible, tabs, columns, Mermaid, chart, tooltip, code link, text color)
		// ...blocks({ only: ["callout", "tooltip"] })   only the chosen ones
		// ...blocks({ omit: ["chart"], codeRef: false }) leave some out (`false` also leaves one out)
		// ...blocks({ color: { palette: [...] } })       per-extension options
	],
});
```

You can also add them one by one (`plugins: [callout(), columns(), color({ palette })]`). Adding the same extension twice is a config error.

```css
@import "@monti-cms/admin/styles.css";
@import "@monti-cms/blocks/styles.css";
```

- Editor: callout, collapsible, tabs and columns come with their edit screens (admin theme colors, `styles.css`). Mermaid and chart are
  edited with a code input and a preview. The preview is drawn by this extension (the app installs the optional dependencies `mermaid` and `recharts`, which are loaded only when a preview opens),
  and if the site registers the same name through `fencePreviews` (`@monti-cms/admin`), that one wins. Chart colors are the CSS variables `--chart-1` to `--chart-5`,
  and if the app does not set them, the defaults in `styles.css` apply.
- Inline marks: the tooltip is offered in the formatting toolbar (after link), the text bubble and the slash menu; text color in the formatting toolbar (after inline marks) and the text bubble; and the code link in the text bubble
  (when the document has a code block) plus description, relink and unlink for the link at the cursor (see "Text marks" in the `@monti-cms/admin` README).
  Code line labels, the "Link to body" item in the code block line menu, the linking hint line and the highlight of the hovered line are core code block features, and they use this mark through this extension's
  `to` attribute (`codeAnchor`). The in-code tooltip (`// @char Tooltip`) is a core code block feature.
- The text color picker list is `color({ palette })` (the default 8 colors `DEFAULT_TEXT_PALETTE` if omitted). The body stores hex values, so changing the list leaves
  already written text as it is. Public pages render with `cleanTextColor` and `textColorProps` from `@monti-cms/blocks/color`, and the color is
  chosen to match the theme by `.cms-color` in `styles.css`.
- Public pages: each extension provides default public components (the plugin `render`, used automatically by `renderMdx` from `@monti-cms/core/render`).
  Only the parts that run in the browser (tab switching, tooltip, code link, Mermaid, chart) are split into `"use client"` files. Mermaid and chart render only when the app installs the optional dependencies
  `mermaid` and `recharts` (on the server and before loading, the source text is shown), and the callout default title, collapsible
  default title and chart error messages follow the site language (`locale`). The look is the `cms-block-*` classes in `styles.css` (no Tailwind needed), and passing components of the same
  name (`Callout`, `Tabs` …) to `renderMdx({ components })` wins. Code fence blocks are turned into
  `<Mermaid source="…" />` by `remarkFenceBlocksToMdx` (`@monti-cms/core/mdx`). Column widths are read with `parseColumnWidths` and `columnsGridTemplate` from `@monti-cms/blocks/columns`,
  and chart syntax and size with `parseChartDsl`, `normalizeChartDsl` and `resolvePieGeometry` from `@monti-cms/blocks/chart`.
- Changing the editor look: the app sets the variables in `styles.css` (`--cms-callout-note`, `-tip`, `-info`, `-warning`, `-danger`, `--chart-1` to `5`).
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

// banner/admin.ts: a provider that supplies a full edit screen (blockViews) or an attribute box (blockEditors)
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
