# @monti-cms/mdx

English | [한국어](README.ko.md)

MDX for `@monti-cms/core`. Core stores a body as a document and has no text format of its own; this package adds the MDX one.

- the **`mdx` format**: `format: "mdx"` on the read and write APIs, `?format=mdx` on the export and the HTTP API, and the text the AI plugin's model reads and writes;
- **`renderMdx`** for the public page: MDX text is read into a document and drawn by core's renderer (no MDX is compiled or executed);
- the **source panel** of the admin: edit a body as MDX text, checked as it is typed;
- the **syntax extension API** (`SyntaxExtension` and friends) that `@monti-cms/syntax-directive` and `@monti-cms/syntax-shiki` build on;
- the code that reads old stores which kept bodies as MDX text, when `monti migrate` needs it.

## Installation

Not on npm yet. Until the public release, install the release bundle from the `release` branch by GitHub address (pnpm only), as described in the repository README.

```json
{
	"dependencies": {
		"@monti-cms/mdx": "github:monti-cms/monti#release/v0.1.0&path:/mdx"
	}
}
```

It needs `@monti-cms/core` and `react` as peer dependencies, and `@monti-cms/admin` (optional) for the source panel. The AI extension (`@monti-cms/ai`) peers on this package.

## Registration

Add `mdx()` to `plugins` in the site config, and import the styles after the admin styles.

```ts
// cms.config.ts
import { defineConfig } from "@monti-cms/core";
import { mdx } from "@monti-cms/mdx";
import { directiveSyntax } from "@monti-cms/syntax-directive";

export default defineConfig({
	// …
	plugins: [mdx({ syntax: [directiveSyntax()] })], // `mdx()` alone for standard MDX
});
```

```css
@import "@monti-cms/admin/styles.css";
@import "@monti-cms/mdx/styles.css"; /* after the admin package styles */
```

| Option | Meaning |
| --- | --- |
| `syntax` | Syntax extensions (experimental) in writing-precedence order. Content written in an extension's notation is read only while it is listed ("Syntax extensions") |

A site without `mdx()` accepts documents (`doc`) only: a text write fails with `unknown_format`, and the admin has no source toggle.

## Entry points

| Entry point | Used in | Contents |
| --- | --- | --- |
| `@monti-cms/mdx` | `cms.config.ts`, syntax extension packages | The plugin `mdx({ syntax })` and the syntax extension API: the types (`SyntaxExtension`, `SyntaxContext`, `SerializeContext`, ...), `RAW_SOURCE_PARAGRAPH`, the table helpers and the code comment syntax helpers. It stays light (no remark imports) because the config imports it |
| `@monti-cms/mdx/format` | server code, tests | `mdxFormat`, `createMdxFormat({ syntax })`, and the parse and write API: `analyze`, `serialize`, `toDocument`, `bodyFromMdx`, `bodyFromDocument`, `bodyDocument`, `documentToMdx`, `toStoredDocument`, `fromStoredDocument`, `parseMdxAst`, `insertSoftBreaks`, `readableMdx`, `compareMdxStructure`, `configuredSyntax`, `remarkFenceBlocksToMdx`, ... |
| `@monti-cms/mdx/render` | public pages (server components) | `renderMdx(source, options)` |
| `@monti-cms/mdx/admin` | the admin (loaded by the plugin) | `MdxSourcePanel`, `EditorToggle`, `mdxBrowserFormat`, `createMdxBrowserFormat`, and the admin provider that registers them |
| `@monti-cms/mdx/server` | the plugin, migrations | `createServerMdxFormat`, `legacyBodies`: what the old store migrations use ("Old databases") |
| `@monti-cms/mdx/testing` | tests | `mdxWith(syntax)`, `docOfMdx(mdx, syntax?)`, `readSamples()`, `renderFixture(source, options)` and re-exports of the pipeline functions |
| `@monti-cms/mdx/styles.css` | the app CSS | the source panel styles |

## The `mdx` format

Reading and writing go through the format, and core validates and stores what it returns ("Formats" in the core README). Text that does not read (it does not parse, uses `import`/`export` or an expression, has front matter) is not half converted: a draft keeps it as an `unparsed` document with the findings, and publishing is blocked until it is fixed. The validation texts are in the message namespace `cms.mdx`.

Stored MDX is **CommonMark + GFM + standard MDX JSX**. What is written by default, with no syntax extension:

| Meaning | Written as |
| --- | --- |
| line break | `<br />` (in a paragraph the next line follows it: `line<br />` + newline + `next`). `\` + newline, two trailing spaces and `<br />` are all read and written this way. A single newline inside a paragraph is only a space, on the page and in the editor alike (CommonMark) |
| blank line (Enter pressed between blocks in the editor) | a line of only `<br />`, one per empty paragraph, kept in order. The document node is an empty `paragraph`. Blank lines at the very end of a body are not written |
| underline, superscript, subscript, translation notice | `<u>`, `<sup>`, `<sub>`, `<Untranslated>` |
| text alignment | `<TextAlign align="center">` |
| table with merged cells, column widths or a non-GFM header | `<Table>`, `<TableRow>`, `<TableCell colspan="2">` (other tables stay GFM) |
| media image, or an image with size, alignment, caption, crop, rotation or decorative flag | `<Image mediaId="…" />` (a plain external image stays `![alt](src "title")`) |
| file card | `<File mediaId="…" />` |
| container and leaf blocks (callout, tabs, columns, site blocks) | `<Component attributes>` … `</Component>`; booleans are bare when true and omitted when false |
| text decorations (tooltip, code link, text color, site text blocks) | `<Component attributes>text</Component>` |

One meaning has one written notation: other notations are still accepted when text is read, and the document is what is stored. A code block is written with Monti annotation comments (`// @line plus {0-0}`), so other tools that read the MDX still see them.
An internal link is written as the real path of its target (`[x](/en/posts/slug)`) for a text readers see, and as `entry:<id>` for a text to be imported again (`purpose: "sync"`).

## Rendering

```tsx
import { renderMdx } from "@monti-cms/mdx/render";

const entry = (await cms.read.getEntry({ collection: "post", slug, locale })).entry;
const { content, toc, unknown } = await renderMdx(source, { locale, refs: entry.refs, components });
```

`renderMdx(source, options)` is `mdxFormat.import(source)` followed by core's `renderDocument(doc, options)`, so it takes the same options (`components`, `refs`, `locale`, `strict`, ...) and returns `{ content, toc, unknown }`. Nothing is compiled or executed. A text the format cannot read throws, since nothing of it can be trusted.
The `syntax` option defaults to the site's `mdx({ syntax })`. Pass `refs: entry.refs` to draw registered images, files and internal links. A site that stores documents does not need this function: `CmsContent` and `renderDocument` of `@monti-cms/core/render` draw the document directly ("Rendering a stored document" in the core README).

## The source panel

The `mdx()` plugin registers, through its admin provider, the **source panel** and the browser side of the `mdx` format in the admin (`useCmsAdminComponents().sourcePanels`, `useFormat("mdx")`). The toggle at the end of the editor toolbar switches a body between the visual editor and the MDX text. The text is parsed in the browser as you type and the document it reads as is what is saved; a text that does not read is kept as an `unparsed` document with the findings shown beside it.
Without `mdx()` in `plugins`, there is no source toggle. The panel's messages are in the namespace `cms-mdx.source`. Recovery copies saved by a browser before documents existed (the body as MDX in `form.mdx`) are kept as an `unparsed` document, and the panel reads them again.

## Syntax extensions

An extension adds a notation by providing both halves of it: how it is read and how it is written. List them in `mdx({ syntax })`; the order is the precedence for writing.

- [`@monti-cms/syntax-directive`](../syntax-directive) reads and writes directives (`:::callout{…}`, `::image{…}`, `:u[text]`, `::::table`), the notation Monti used before standard MDX. Without it, `:::callout` is ordinary text.
  `directiveSyntax({ write: false })` only reads directives and saves standard MDX, which migrates content a post at a time as it is saved.
- [`@monti-cms/syntax-shiki`](../syntax-shiki) reads Shiki code notation in code fences (`// [!code ++]`, `[!code highlight]`, `[!code focus]`) and turns it into Monti's code annotations. It only reads.
- The public renderer reads with the same extensions as the editor, so what the editor reads is what the site renders.

### Writing a syntax extension (experimental)

The interface is experimental and may change in a minor release.

```ts
interface SyntaxExtension {
	name: string;
	/** Parsing: remark plugins (or a function of the site's blocks that returns them). */
	remarkPlugins?: PluggableList | ((context: SyntaxContext) => PluggableList);
	/** CmsNode → MDX. Keyed by node type (or the renderer name of a block); "*" matches the rest. Return undefined to defer to the next extension, then the standard serializer. */
	fromDocument?: Record<string, (node: CmsNode, context: SerializeContext) => string | undefined>;
	/** Marks this extension writes, keyed by mark type; the same defer rule. `inner` is the written content. */
	fromMark?: Record<string, (mark: CmsMark, inner: string, context: SerializeContext) => string | undefined>;
	/** Escapes body text so it is not read as this syntax (for example `\:name`). */
	escapeText?: (text: string, context: SerializeContext) => string;
}
```

`SyntaxContext` gives the site's blocks (`blocks.list`, `blocks.byName`, `blocks.byComponent`) and the names of its code block line effects (`codeLineEffects`). `SerializeContext` adds `indent` (the indentation of the line the node starts on, which the writer must include),
`serializeBlocks` and `serializeInlines` for children, `componentName`, `hasSpread`, `nodeAttributes` and `markAttributes` (the attribute list the standard notation uses), and `escapeAttribute`.
Line breaks are always `<br />` and are not offered to extensions; an `image` node is offered only when Markdown cannot say it. A remark plugin that turns source text back into a paragraph to be written as is marks it with `RAW_SOURCE_PARAGRAPH`.
The root entry also exports the table helpers (`tableHasMergedCells`, `tableWidths`, `formatTableWidths`, ...) and the code comment syntax helpers (`resolveCommentSyntax`, `formatAnnotationComment`) for extensions that write tables or code comments. The directive extension (`packages/syntax-directive`) is the reference implementation.

## Old databases

Stores from before stored documents kept every body as MDX text. Core still lists the steps that moved them (`0010`, `0011`, `0012`, `0013`, `0015`) under their old names, but it does not parse MDX: those steps read and write the text through the `mdx` format that `@monti-cms/mdx/server` supplies (`CmsFormat.legacyBodies`, the `LegacyBodies` type of `@monti-cms/core/format`).

- A step asks for the format **only when a store actually has a body to read** through it. A fresh store and a store already past those steps never need this package at migrate time.
- When one does and the package is missing, `monti migrate` fails with a message that says to install `@monti-cms/mdx` and add `mdx()` to the plugins of the site config to upgrade the database.
- `monti migrate` and `cms.migrate()` pass the instance's formats (the ones its plugins provide) to the migration, so a site that lists `mdx({ syntax: [...] })` migrates old data with the right syntax extensions.
- `entry_bodies.mdx` and `body_templates.mdx` are nullable (the step `0020_mdx_columns_optional`) and nothing writes them any more. They are not dropped, so old rows keep their text.

## Upgrading from MDX in core

MDX used to be built into core, configured with `defineConfig({ mdx: { syntax } })`. Do this **before** deploying:

1. Install `@monti-cms/mdx`.
2. Add `mdx()` to `plugins` and **move** `mdx.syntax` into it: `plugins: [mdx({ syntax: [directiveSyntax()] }), ...]` (for the owner-style blog, `directiveSyntax()` with write mode on; keep the same options).
3. Add `@import "@monti-cms/mdx/styles.css";` to the app CSS, after the admin styles.
4. Replace `renderMdx` imports from `@monti-cms/core/render` with `@monti-cms/mdx/render` (or render documents with `CmsContent`), and `cms.read.imageResolver(...)` with `entry.refs`.
5. Replace imports of `@monti-cms/core/mdx`, `@monti-cms/core/syntax` and `@monti-cms/core/format/mdx`: the syntax extension interface comes from `@monti-cms/mdx`, the parser and writer from `@monti-cms/mdx/format`.
6. Block extensions you wrote: drop the default export of your render modules and keep `documentComponents`.
7. Run `monti migrate`. With `mdx()` installed, an old database upgrades. Without it, a store that still has old steps to run fails with the install message.
8. Drop `monti content:rewrite` from scripts: it is removed.

The full list of changes is in "Upgrading from MDX in core" in the core README.

## Development

```bash
pnpm --filter @monti-cms/mdx test:run
pnpm --filter @monti-cms/mdx typecheck
```

The parser, writer and format tests, with the sample posts in `src/__test__/fixtures/samples`, live in this package; the source panel tests run in a jsdom environment (`// @vitest-environment jsdom`). Some tests use a database, so `.env.local` needs `CMS_TEST_DATABASE_URL` (see the repository README).
Tests of a site or of another package that need MDX text import the helpers of `@monti-cms/mdx/testing`: `mdxWith(syntax)` builds the pipeline with a given list of extensions, `docOfMdx(mdx)` gives the stored document of a text, `readSamples()` the sample posts, and `renderFixture(source)` the markup, table of contents and React tree of a text.
