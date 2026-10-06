# @monti-cms/core

English | [한국어](README.ko.md)

The core of a DB (Postgres)-backed blog CMS. It handles the site config, collection schemas, content saving and publishing, MDX conversion, the admin API and plugin wiring.
The admin UI is `@monti-cms/admin` and the AI features are the plugin `@monti-cms/ai`. `examples/other-site` is an example with everything wired together.

## Install in an empty Next app

This assumes a Next 16 (App Router), React 19 and Tailwind CSS 4 app. Only Postgres is supported as the store. The order is `monti init` → edit the collections → `monti migrate`.

### 1. Packages

```sh
pnpm add @monti-cms/core @monti-cms/admin next-auth@5.0.0-beta.32 next-themes @tanstack/react-query sonner \
  @tiptap/core @tiptap/pm @tiptap/react lucide-react
pnpm add -D tw-animate-css @tailwindcss/typography
```

The admin package and the AI plugin must share one copy of React Query, sonner, Tiptap and the lucide icons with the app, so the app installs them (peers).
`next-auth` is only needed when you use GitHub login (`githubAuth`).
The `monti` command line ships inside `@monti-cms/core` (TypeScript config files are read by tsx, which is installed with it).

pnpm 12 fails the install if there are install scripts that have not been allowed (10 only warns). Allow the install script of esbuild, which tsx uses.

```yaml
# pnpm-workspace.yaml (app folder)
allowBuilds:
  esbuild: true
```

### 2. `monti init`

Run it in the app folder (where `package.json` is). **It never overwrites existing files**; it reports them as "skipped files". It is safe to run again.

```sh
pnpm exec monti init                       # admin at /admin, English (en), time zone UTC
pnpm exec monti init --admin-path /studio  # to change the admin path
pnpm exec monti init --locale ko --time-zone Asia/Seoul  # to set the site's default language and time zone
```

| What it does | File |
| --- | --- |
| Site config (a one-collection starting point, English labels) | `cms.config.ts` |
| Server config (DB, GitHub login; secrets come from environment variables) | `cms.server.ts` |
| Admin UI | `app/(admin)/admin/[[...path]]/page.tsx`, `layout.tsx` |
| Admin API and login (`/api/cms/v1/*`, `/api/cms/auth/*`) | `app/api/cms/[...path]/route.ts` |
| Config aliases `@cms-config`, `@cms-server` | added to `paths` in `tsconfig.json` |
| Admin style line | added after the last `@import` in the global CSS (`app/globals.css`, etc.) |
| Config wiring (`withCms`) | `next.config.ts` (when it has the default shape with a single `export default nextConfig;` line); created if missing |

For apps that use `src/app`, the config files go in `src/` and the routes under `src/app/`. Files that cannot be edited safely (a `tsconfig.json`
with comments, a next config that does not have the default shape, CSS without Tailwind 4) are left as they are, and what to add is shown as a "to do".
At the end it lists the packages to install, the environment variables and the GitHub callback URL.

With `--admin-path`, the route folder becomes that path (`app/(admin)/studio/…`) and `admin: { path: "/studio" }` is added to the site config.
**The admin path must be the same in the site config `admin.path` and in the route folder.** When you change it later, change both together.
The admin API path (`/api/cms/v1`) does not change.

`--locale <code>` is the site's default language (`defaultLocale`) and defaults to `en` (a lowercase language code such as `ko`). The admin UI's language and
date and number formatting follow it, and can be chosen separately with `admin.locale` in the config. `--time-zone <zone>` is the time zone in which dates and times are entered and
shown (an IANA name, default `UTC`). The generated config files and the command-line help and output are read by developers, so they are in English.

### 3. Edit the collections

`cms.config.ts` is read by both the server and the admin UI. Do not put secrets in it. The generated starting point looks like this.

```ts
import { defineCollection, defineConfig, fields } from "@monti-cms/core";

const post = defineCollection({
	label: "Post",
	kind: "document", // body, draft and publishing. Use "item" for small entries such as tags
	path: "/posts/:slug", // public URL. Used for internal links in the body and for preview URLs
	icon: "file-text", // admin sidebar icon (lucide name)
	fields: {
		title: fields.text({ label: "Title", required: true, max: 200 }), // the title field is named `title`
		slug: fields.slug({ label: "Slug", from: "title", required: true }),
		summary: fields.text({ label: "Summary", role: "summary", multiline: true, fillFromBody: true }),
	},
	// Without layout and list, fields are drawn in field order with the default list columns ("Collections").
});

export default defineConfig({
	collections: { post },
	locales: [{ code: "en", name: "English" }],
	defaultLocale: "en",
	site: { name: "My site" },
	timeZone: "UTC",
});
```

The collection name (`post`) is stored in the DB, so do not change it in production. See "Config" below for the field rules.

The server config `cms.server.ts` holds the store, media and login connections and the secrets, and is only read on the server. Connections are created on first use, so
the environment variables may be empty during the build. To use image uploads, add a store from `@monti-cms/core/s3` to `media` and install the AWS SDK
(`pnpm add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner`, only for sites that use media):

```ts
import { r2Storage, s3Storage } from "@monti-cms/core/s3";

// Cloudflare R2
media: r2Storage({ endpoint, bucket, accessKeyId, secretAccessKey, publicBaseUrl }),
// AWS S3
media: s3Storage({ endpoint: "https://s3.ap-northeast-2.amazonaws.com", region: "ap-northeast-2", bucket, accessKeyId, secretAccessKey, publicBaseUrl }),
// Path-style, e.g. MinIO
media: s3Storage({ endpoint: "http://localhost:9000", forcePathStyle: true, bucket, accessKeyId, secretAccessKey, publicBaseUrl }),
```

For another store, pass a `MediaAdapter` (`{ name, createStore() }`) that implements the `MediaStore` contract from `@monti-cms/core/server`.

### 4. Environment variables and `monti migrate`

Put them in `.env.local`.

| Name | Meaning |
| --- | --- |
| `CMS_DATABASE_URL` | Postgres connection URL |
| `CMS_SCHEMA` | Optional. Schema name (`public` if unset). When attaching to a DB that already has app tables, it is safer to keep it separate. `monti migrate` creates it if missing |
| `AUTH_SECRET` | A random long value. Signs login sessions (`githubAuth({ secret })`) |
| `CMS_SECRET` | A random long value (different from `AUTH_SECRET`). Encrypts stored values (AI service keys) (server config `secret`). If you change it, re-enter the stored keys |
| `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET` | GitHub OAuth app. The callback URL is `<site URL>/api/cms/auth/callback/github` |
| `CMS_ADMIN_GITHUB_ID` | The admin's numeric GitHub ID |
| `CMS_DEV_AUTH_BYPASS` | Optional. If `1`, requests from your own machine open the admin without login under `next dev` (see "Login bypass for development") |
| `AUTH_TRUST_HOST` | Optional. `true` when the server runs behind a proxy or on a platform that sets `Host` and `X-Forwarded-Host` (Vercel, nginx, a load balancer); see "Host trust" |

```sh
pnpm exec monti migrate
```

It creates the tables or brings them to the latest shape (including plugin tables). Running it several times gives the same result, and you run it again after upgrading the packages.
Core changes are recorded in `cms_migrations` as numbered steps, and only steps that have not run yet are run (in one transaction); even when run concurrently
against the same schema, they run one at a time. A plugin hands over once-only work with `db.once(name, fn)`.

- Env files: by default `.env.local` and `.env` (only those that exist) are read. Values from the shell win, and earlier files win over later ones.
  Choose files with `--env-file <file>` (repeatable); `--no-env-file` reads none.
- Config files: looked up in this order: `--config`/`--server` → `CMS_CONFIG_PATH`/`CMS_SERVER_PATH` → aliases in `tsconfig.json` `paths` →
  `./cms.config.ts`/`./src/cms.config.ts`.
- The old way (put `import "@monti-cms/core/migrate";` in `migrate.ts` and run `tsx --import @monti-cms/core/register migrate.ts`) still works.

#### `monti content:rewrite`

```sh
pnpm exec monti content:rewrite           # a dry run: reports what would change, writes nothing
pnpm exec monti content:rewrite --apply   # writes the changes
```

Rewrites every stored body (the working and published bodies of entries, and body templates) from its stored document with the site's configured syntax ("Stored bodies" under "Body syntax"), so the stored text is one notation:
after turning `directiveSyntax()` on or off, or after upgrading the serializer, this brings old bodies in line at once instead of one post at a time as each is saved. Run it after `monti migrate`.
It takes the same `--env-file`, `--no-env-file`, `--config` and `--server` options as `migrate`.

- It prints one line per body, `collection/slug (locale) state: changed|unchanged`, and a summary.
- Only the text (and the document, for a body that had none) changes. The content hash covers the parsed body, so a re-spelled body has the same hash: `version`, `updated_at` and `content_hash` are not touched, and "unpublished changes" is unaffected.
  The command checks this for every body: one whose hash would change is skipped and reported, never written.
- A body that has no document and does not parse cleanly (or has front matter) is skipped and reported. The search text of rewritten bodies is refreshed; the positions the reference index keeps (line and column of each link or image) are refreshed the next time the entry is saved.
- Writes happen in one transaction, and a second run changes nothing.

### 5. Run

Start it with `next dev` and open the admin path (default `/admin`).

### Login path

By default the GitHub login API is served by the admin API route as well (`/api/cms/auth/*`), so there is no separate login route file.
Apps that still use `/api/auth/*` as before (apps that do not want to change an already registered OAuth callback URL) pick the path and add a route file.

```ts
// cms.server.ts
auth: githubAuth({ /* … */, basePath: "/api/auth" }),

// app/api/auth/[...nextauth]/route.ts
import { handlers } from "@monti-cms/core/runtime";
export const { GET, POST } = handlers;
```

If `basePath` is not the default, the admin API route does not serve `/api/cms/auth/*` (404).

### Optional dependencies

Optional dependencies of the CMS packages (e.g. `mermaid` and `recharts` of the blocks extension) are installed only when you use that feature. For anything not installed, `withCms`
links an empty module (`@monti-cms/core/stubs/missing-optional`) so the build does not stop, and using that feature raises an error telling you to install it.
After installing, restart the dev server.

### Manual wiring (without `monti init`)

To do by hand what `monti init` does: create the two config files, wrap `next.config.ts` in
`withCms(nextConfig, { config: "./cms.config.ts", server: "./cms.server.ts" })`, add
`"@cms-config": ["./cms.config.ts"]` and `"@cms-server": ["./cms.server.ts"]` to `tsconfig.json` `paths` (and to `resolve.alias` if you use tests (Vitest)),
add the set of route files from the table above, and put the following lines in the global CSS.

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "@monti-cms/admin/styles.css"; /* defines the `cms-*` colors and the `cms-dark`, `cms-horizontal` and `cms-vertical` variants (names do not collide with the app's). Requires Tailwind 4 */
@plugin "@tailwindcss/typography";
```

### Blocks extension (optional)

```sh
pnpm add @monti-cms/blocks
```

```ts
// cms.config.ts
import { blocks } from "@monti-cms/blocks";

export default defineConfig({
	// …
	plugins: [...blocks()], // all of them. To pick: blocks({ only: ["callout", "tooltip"] }); one at a time: callout(), tabs()…
});
```

```css
@import "@monti-cms/blocks/styles.css"; /* after the admin package styles */
```

See the README of `@monti-cms/blocks` for details.

### AI plugin (optional)

```sh
pnpm add @monti-cms/ai
```

```ts
// cms.config.ts
import { aiPlugin } from "@monti-cms/ai";

export default defineConfig({
	// …
	// The default features (URL, summary and tag suggestions, etc.) attach automatically based on field kind, role and relation target. List only what you change or turn off in `actions`.
	plugins: [aiPlugin({ siteDescription: "a developer blog" })],
});
```

```css
@import "@monti-cms/ai/styles.css"; /* after the admin package styles */
```

See the README of `@monti-cms/ai` for details.

### SEO extension (optional)

```sh
pnpm add @monti-cms/seo
```

```ts
// cms.config.ts
import { seo, seoFields } from "@monti-cms/seo";

const article = defineCollection({
	// …
	fields: { title, slug, ...seoFields() }, // search title, description, share image, hide, canonical URL + preview, all in the SEO tab
});

export default defineConfig({
	// …
	plugins: [seo()],
});
```

See the README of `@monti-cms/seo` for details.

## Entry points

| Entry point | Used in | Contents |
| --- | --- | --- |
| `@monti-cms/core` | `cms.config.ts` | `defineConfig`·`defineCollection`·`fields`·`defineBlock`·`definePlugin` |
| `@monti-cms/core/server` | `cms.server.ts` | `defineServerConfig`, `postgres`, `githubAuth`, store contract types (`MediaStore`, etc.). Store modules are loaded on first use |
| `@monti-cms/core/s3` | `cms.server.ts` | `r2Storage`, `s3Storage` (S3 API media stores; the AWS SDK is an optional dependency) |
| `@monti-cms/core/next` | `next.config.ts` | `withCms` |
| `@monti-cms/core/next/route-handler` | admin API route | `createCmsRouteHandler` |
| `@monti-cms/core/render` | public pages (server components) | `renderMdx(mdx, options)` → `{ content, toc }`. In the site CSS: `@import "@monti-cms/core/render.css";` |
| `@monti-cms/core/read` | public pages (server components, sitemap, RSS) | `getEntry`, `listEntries`, `getTranslations`, `getPreview`: read published content (relations, URLs, old-URL redirects, source fallback) |
| `@monti-cms/core/runtime` | server code (including cron scripts and site tests) | stores, services, login checks, public media URLs (`resolvePublicMediaUrl`). It does not use `server-only`, so it can be loaded outside Next (`tsx --import @monti-cms/core/register`) |
| `@monti-cms/core/client` | UI code | API shapes, collection, locale, URL, block and schema helpers |
| `@monti-cms/core/mdx`, `/code-block` | public renderer, editor | MDX parsing and serialization, the code block annotation model |
| `@monti-cms/core/syntax` (experimental) | `cms.config.ts`, syntax extension packages | The `SyntaxExtension` interface and the helpers extensions build on ("Body syntax"). The directive notation is `@monti-cms/syntax-directive` |
| `@monti-cms/core/plugin/server` | server side of plugins | route scaffolding, DB connection, errors |
| `monti` (command line, package `bin`) | terminal | `monti init` (create files), `monti migrate` (create tables), `monti content:rewrite` (re-serialize stored bodies) |
| `@monti-cms/core/cli` | command-line tooling | `runCli`, `initProject`, `migrate`, `contentRewrite` (the code behind the `monti` command) |
| `@monti-cms/core/migrate`, `/register` | command line (old way) | create tables; wire the config aliases in custom scripts |
| `@monti-cms/core/testing` | tests | isolated-schema DB, sample data, the MDX parser and remark plugins of a given extension list (`parseMdxAst`, `syntaxRemarkPlugins`) |

## Building the packages

Inside the repository the sources (`src`) are used directly. For the distributable bundle, `pnpm build:packages` produces `dist` and `pnpm pack` packages it using
`publishConfig.exports` (dist). `pnpm example:pack` puts the bundle into `examples/other-site/vendor`.

## Body syntax

Stored MDX is **CommonMark + GFM + standard MDX JSX**. Anything beyond that is an opt-in *syntax extension* that provides both halves of a notation: how it is read and how it is written.
One meaning has one stored notation: other notations are still accepted when content is read and are converted when it is saved.

What is written by default, with no extension:

| Meaning | Stored as |
| --- | --- |
| line break | `<br />` (in a paragraph the next line follows it: `line<br />` + newline + `next`). `\` + newline, two trailing spaces and `<br />` are all read and written this way. A single newline inside a paragraph is only a space, on the page and in the editor alike (CommonMark) |
| blank line (Enter pressed between blocks in the editor) | a line of only `<br />`, one per empty paragraph, kept in order. The document node is an empty `paragraph`. Blank lines at the very end of a body are not stored |
| underline, superscript, subscript, translation notice | `<u>`, `<sup>`, `<sub>`, `<Untranslated>` |
| text alignment | `<TextAlign align="center">` |
| table with merged cells, column widths or a non-GFM header | `<Table>`, `<TableRow>`, `<TableCell colspan="2">` (other tables stay GFM) |
| media image, or an image with size, alignment, caption, crop, rotation or decorative flag | `<Image mediaId="…" />` (a plain external image stays `![alt](src "title")`) |
| file card | `<File mediaId="…" />` |
| container and leaf blocks (callout, tabs, columns, site blocks) | `<Component attributes>` … `</Component>`; booleans are bare when true and omitted when false |
| text decorations (tooltip, code link, text color, site text blocks) | `<Component attributes>text</Component>` |

The migration `0012_soft_line_endings` (run by `monti migrate`) keeps bodies written while a single newline rendered as a break looking the same: it writes a `<br />` at each such line ending in paragraph text of
working and published bodies, translation base sources and templates, editing the stored string at the parser's offsets only (code, math, tables, attributes and expressions are never touched, and a body that does not parse is left as it is and reported).

To add a notation, list extensions in `mdx.syntax`. The order is the precedence for writing.

```ts
import { directiveSyntax } from "@monti-cms/syntax-directive";

export default defineConfig({
	// …
	mdx: { syntax: [directiveSyntax()] },
});
```

- [`@monti-cms/syntax-directive`](../syntax-directive) reads and writes directives (`:::callout{…}`, `::image{…}`, `:u[text]`, `::::table`), the notation Monti used before standard MDX. Without it, `:::callout` is ordinary text.
  `directiveSyntax({ write: false })` only reads directives and saves standard MDX, which migrates content a post at a time as it is saved (or all at once with `monti content:rewrite --apply`). Line breaks are never written as `:br[]`.
- [`@monti-cms/syntax-shiki`](../syntax-shiki) reads Shiki code notation in code fences (`// [!code ++]`, `[!code highlight]`, `[!code focus]`, counts such as `[!code ++:3]`) and turns it into Monti's code annotations (`// @line plus`). It only reads: bodies are always written with Monti's annotations.
- The public renderer (`@monti-cms/core/render`) runs the same plugins as the editor's parser, so what the editor reads is what the site renders.

**Upgrading a site that has directive content.** Install `@monti-cms/syntax-directive` and add `directiveSyntax({ write: false })` to `mdx.syntax` (or `directiveSyntax()` to keep writing directives) before deploying this version.
`directiveSyntax` is no longer exported by `@monti-cms/core/syntax`: change the import to `@monti-cms/syntax-directive`.
Without the extension, existing posts render directive text literally and fail validation (`{…}` in `:::callout{…}` is read as an expression). With `write: false`, the content hash (which hashes the parsed body) of a post does not change when it is saved in the standard notation.
Remove the extension once no stored body uses directives.

#### Stored bodies

Every body (the working and published bodies of entries, the source a translation was confirmed against, and body templates) is stored as a versioned **document** (`entry_bodies.doc`, `body_templates.doc`: the parsed body as JSON) together with the **MDX written from it**.
The document is the source and the MDX is its text, so saving normalizes notation: the same content always gets the same text, whatever spelling it was typed in (`Title` + `=====` and `# Title` are stored as `# Title`), and saving a body in another spelling of the content it already has changes nothing (no new version).
Source mode in the editor is secondary: the text you type is parsed and written back in the site's notation when you save.
A body that does not parse, or that has front matter, has no document and is stored exactly as given (only a draft can be like that).

**Code blocks.** A code block is stored as its code (without annotation comments) and its annotations as data (line effects, text effects and regex rules), and written back to MDX as Monti annotation comments, so other tools that read the MDX still see them.
`monti migrate` runs the step `0015_code_annotations`, which converts existing documents (including the document a translation was confirmed against) and rewrites the annotation comments of code fences in their canonical form (`// @line plus` becomes `// @line plus {0-0}`, rules for the whole code come first). It recomputes the content hash and search text, which no longer holds annotation comments; `version` and `updated_at` do not change.

**Block ids.** Every block of the document has an `id` (8 characters of base36) that is unique within the body. It says which block is which across versions: it is not written to MDX and is not part of the content hash, so it never counts as a change.
A body saved as MDX inherits ids from the version it replaces: a block that reads the same keeps its id, and so do edited, split and moved blocks (the first part of a split paragraph keeps it); blocks with no partner get new ids, and a document sent through the API keeps the ids it carries.
`monti migrate` runs the step `0014_block_ids`, which gives the existing documents their ids (and gives a published body the ids of the working blocks it shares); it changes only `doc`, never the MDX, the hash, `version` or `updated_at`.
The admin editor keeps every block's id while you edit and saves the document instead of its MDX, so blocks keep their ids exactly; text it did not write (source mode, a template) is saved as MDX and paired as above.
The ids are what the admin uses to point at a block: a publish issue or reference position names its block (`position.blockId`, next to `line` and `column`) and opens it in the visual editor, the translation screen compares the source a translation was confirmed against with the current source block by block (a block that only moved shows as moved), and AI translation finds the block it translates by its id.

**Upgrading.** Set `mdx.syntax` the way the site should write before running `monti migrate`, which runs the step `0013_stored_documents`. It adds the `doc` columns, gives every existing body its document and **rewrites its MDX in the site's notation** (so the stored text of many bodies changes at once; `version` and `updated_at` do not).
Bodies that do not parse, have front matter or would not read back the same are left as they are, without a document, and each is logged (`[monti] no stored document for …`). Back up the database first and read the log after the run.
`monti content:rewrite` now rewrites from the document and gives a body without one a document when it parses.

- **Admin entry API.** `POST /api/cms/v1/entries` and `PATCH /api/cms/v1/entries/:id` accept `doc` (the document JSON as read back from `working.doc` / `published.doc` of an entry) instead of `mdx`; sending both is `400 invalid_input`, and so is a document that is not a valid stored document. With neither, a new entry has an empty body and a patch keeps the current one.
  Sending back the `doc` that was read changes nothing. `GET /api/cms/v1/meta` reports the size limit as `limits.docBytes` next to `limits.mdxBytes`. The template API keeps accepting `mdx` only and returns `doc` with each template.
- **Admin export** (`GET /api/cms/v1/export`) is format version 2: each body that has a document also has `working.doc.json` / `published.doc.json` next to `working.mdx` / `published.mdx`, `templates.json` items have `doc`, and the digests cover the document.
- **Public read API and public export** are unchanged: MDX only, no `doc` (the public export only carries the new `formatVersion`).

### Writing a syntax extension (experimental)

`@monti-cms/core/syntax` is experimental and may change in a minor release.

```ts
interface SyntaxExtension {
	name: string;
	/** Parsing: remark plugins (or a function of the site's blocks that returns them). They also join the public render chain. */
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
Line breaks are always `<br />` and are not offered to extensions; an `image` node is offered only when Markdown cannot say it. The directive extension (`packages/syntax-directive`) is the reference implementation, and it imports only from `@monti-cms/core/syntax`.
The entry point also exports the code comment syntax helpers (`resolveCommentSyntax`, `formatAnnotationComment`) that Monti's code annotations use, for extensions that read or write code comments (`packages/syntax-shiki`).

## Body blocks

The core only has the blocks that other features rely on or that are Markdown syntax (image, file, table, math, alignment, underline, superscript/subscript, line break, translation notice).
Callout, fold, tabs, columns, Mermaid, charts and text decorations (tooltip, code link, text color) come from the blocks extension `@monti-cms/blocks`, where you install
only what you need as plugins.

```ts
import { blocks } from "@monti-cms/blocks";

plugins: [...blocks({ only: ["callout", "mermaid", "tooltip"] })],
```

Blocks the site creates itself go into `blocks` in the config. The blocks extension adds blocks with the same definition (`definePlugin({ blocks })`).

```ts
import { defineBlock } from "@monti-cms/core";

blocks: [
	defineBlock({
		name: "notice", // stored as <Notice level="warn"> … </Notice>
		label: "Notice",
		syntax: { kind: "container", directive: "notice" },
		component: "Notice", // the public page renders it under this name from the site's MDX component table
		attributes: {
			level: { type: "string", label: "Level", options: { info: "Info", warn: "Warning" }, defaultValue: "info" },
			title: { type: "string", label: "Title", translatable: true }, // the translation screen translates it separately as a heading line
		},
		translateInside: true, // the translation screen expands the box and translates the inner blocks one by one
		editor: {
			view: "node", // "opaque" shows it as a raw-text box in the editor
			insertable: true,
			icon: "message-square", // slash and component menu icon (lucide name)
			insert: { values: { level: "warn" }, text: "Content" }, // initial values on insert
		},
	}),
	defineBlock({
		name: "graphviz", // stored syntax ```graphviz … ```
		label: "Graphviz",
		syntax: { kind: "fence", lang: "graphviz" },
		component: "Graphviz", // on the public page, remarkFenceBlocksToMdx turns it into <Graphviz source="…" />
		attributes: {},
		editor: { view: "node", insertable: true, insert: { code: "digraph { a -> b }" }, placeholder: "Enter Graphviz code" },
	}),
],
```

- The blocks you can add are element blocks (`container`, `leaf`; stored as MDX JSX elements named by `component`, and also as directives with the directive extension, where `directive` is the directive name), text decorations (`text` + `editor.view: "mark"`) and code fence blocks (`fence`).
  A code fence block takes over every code fence of that language, so do not use a common code language name (such as `ts`).
- A text decoration is stored as `<Component attributes>text</Component>` (`:name[text]{attributes}` with the directive extension). Attributes are written in definition order; required attributes (`required`) are written even when empty, and the rest
  only when they have a value. Nested decorations are stored in the order they were added (outermost first). The admin package builds the editor display from the definition, and the look, formatting
  toolbar, bubble and slash menu are registered in the admin UI by the extension ("Text marks" in the `@monti-cms/admin` README). An attribute with `codeAnchor: true`
  makes its value the code block line label (the `anchor` line effect), and the editor's body–code linking uses this decoration (only one per site).
- Choice values, required values and child values (`childValue`, e.g. the tab to open first is one of the tab names) of attributes, and the number of children (`children.min`, `max`) are
  validated before publishing.
- Removing a block that was in use drops it from the stored syntax. Bodies that already used that block turn into plain text when saved again, so do not remove blocks that are in use.
- A container that holds body content starts with an empty paragraph when inserted from the slash menu. `editor.insert.codeBlocks` (`[{ language, title?, code? }]`) starts it with those code blocks instead, `title` being the code fence's `title` meta (the code explorer uses it to start with one `src/index.ts` file).
- The admin package builds editor nodes from the definition. Change the editing look with the admin package's `blockEditors` (attribute and body boxes) or
  `blockViews` (the whole view), and supply previews of code fence blocks with `fencePreviews`.
- For code fence blocks on public pages, put `remarkFenceBlocksToMdx` from `@monti-cms/core/mdx` into the render chain (after the syntax extensions' plugins) so they are rendered
  with `component`.
- The translation structure check (`compareStructure`) only accepts changes in translation for `translatable` attributes and for `childValue` attributes that point at their values (e.g. the tab to open first).
  Put `translatable: true` on human-readable attributes (title, description, etc.).
- If `editor.icon` is a name that is not among the admin package's default icons, register the icon in the admin UI (`@monti-cms/admin` README).

### Code block line effects

The defaults for code block line effects (`// @line name {0-2}`) are highlight, focus, add, remove, warning and error. Focus (`// @line focus`) dims the
other lines of the block until the reader hovers the code or moves the keyboard focus into it (`.code-focus` in `render.css`); a line the body points at with
`:code-ref` is always shown sharp. Add more with `codeBlock.lineEffects` in the config; using the same name overrides the default.

```ts
codeBlock: {
	lineEffects: [
		{
			name: "info", // annotation name (lowercase kebab-case). collapse, anchor and the text effect names cannot be used
			label: "Info", // line effect menu name
			icon: "star", // menu icon (lucide name, a name registered in the admin UI)
			class: "bg-primary/10", // class the public page adds to that line (put it where the site's Tailwind reads)
			editor: { background: "bg-cms-primary/10" }, // editor display (admin colors are `cms-*`, dark theme is `cms-dark:`): background, wavy (wavy underline color), marker({ text, className })
		},
	],
},
```

The public page passes `annotationConfig` (defaults + config) from `@monti-cms/core/code-block` to the render chain.

#### Turning code block tools off, themes and languages

```ts
codeBlock: {
	omitLineEffects: ["plus", "minus"], // line effects the editor does not offer (defaults or ones you added)
	features: { rules: false, fold: false, tooltip: false, textStyles: false }, // editor tools to turn off; all are on unless set to false
	themes: { light: "github-light", dark: "github-dark" }, // Shiki theme names (default one-light / one-dark-pro)
	languages: ["elixir", "zig"], // more Shiki languages to highlight, also offered in the editor's language list
},
```

- `omitLineEffects`: names of line effects to leave out of the editor's line menu.
- `features`: `rules` (regex rules and their panel), `fold` (the line menu's "Collapse" and the fold text effect), `tooltip` (the tooltip text effect)
  and `textStyles` (bold, italic, strikethrough and underline inside code).
- Turning a tool off only removes it from the editor's menus, panels, toolbars and shortcuts. A body that already uses it still loads, renders on the public page,
  edits and saves unchanged, and the effects already in a block stay visible so they can be removed. Parsing, conversion and rendering never read these settings.
- `themes`: one pair of Shiki theme names that the public page and the editor both use. The editor falls back to the default themes if a name is not a Shiki theme.
- `languages`: Shiki language names or aliases (e.g. `elixir`, `zig`) added to the default list. The editor offers them in the language dropdown, labeled by name.
  A fence whose language is not loaded (not in the default list nor in `languages`) renders as plain text.

### Text color list

Text colors come from the blocks extension (`color({ palette })` of `@monti-cms/blocks`). The old config `textColors` is gone (move it to the option).

## Plugins

List it once in `plugins` of the site config (e.g. `aiPlugin()` of the AI plugin `@monti-cms/ai`).

```ts
import { definePlugin } from "@monti-cms/core";

export const myPlugin = () =>
	definePlugin({
		name: "my-plugin",
		options: {}, // JSON value. Read by both the server and the browser
		nav: [{ path: "my", label: "My screen", icon: "plug" }], // admin sidebar "Manage" group
		validate: ({ collections }) => {}, // called when the site config is built
		server: () => import("my-plugin/server"), // CmsServerPlugin: API routes, table creation, meta display
		admin: () => import("my-plugin/admin"), // CmsAdminPlugin (@monti-cms/admin): screens, providers
	});
```

- The server side (`server`) must not end up in the browser bundle, so give an empty entry point through the `browser` condition of the package `exports`.
- `validate` receives the collection, locale and block definitions and all plugins (`plugins`). Extensions that use roles check field kinds here.
- `contributes` is what you add to other plugins. The key and shape are decided by the receiving plugin, and the core does not read them. For example,
  `contributes: { ai: { actions: { … } } }` adds that feature if the AI plugin (`@monti-cms/ai`) is present and is unused otherwise.
  An extension can add features without knowing the receiving plugin (diagram creation in the blocks extension, search title suggestions in the SEO extension).
- The server-side `routes` receive addresses that are not in the core routes (`/api/cms/v1/*`). The core wraps them with the admin login check and the same-origin check, so
  forgetting authentication does not leave an open route. Only routes that must be reachable without login (external runners, webhooks) are taken out with `public: true` and verify on their own.
  `migrate` is called by `monti migrate` after the core tables.
- The same-origin check accepts the host of `Host` and `site.url`, and the first value of `X-Forwarded-Host` only when the host is trusted ("Host trust"). Behind a proxy that rewrites `Host`, set `site.url` or trust the host.
- The server-side `hooks` (`transform`, `validate`, `validatePublish`, `afterCommit`) are the same as the server config's, and run after the server config's hooks, in the order of the plugins. See "Hook contract".
- Plugin code uses `getCmsDatabase()` (the DB connection) from `@monti-cms/core/plugin/server` and the core route scaffolding (`adminRoute`, etc.).

## Server config

| Item | Meaning |
|---|---|
| `database` | Content store. `postgres({ connectionString, schema })` |
| `media` | Store for images and attachments. `r2Storage` or `s3Storage` from `@monti-cms/core/s3` (`region`, `forcePathStyle`), or a connection implementing the `MediaStore` contract. Without it, media features are unavailable. |
| `auth` | Admin login. `githubAuth({ clientId, clientSecret, adminIds, devBypass, basePath?, secret })`. `basePath` is the login API path (default `/api/cms/auth`, see "Login path"), and `secret` is the value that signs login sessions (if unset, NextAuth reads `AUTH_SECRET`) |
| `trustHost` | Optional. Whether `Host` and `X-Forwarded-Host` can be trusted ("Host trust"). Default: the `AUTH_TRUST_HOST` environment variable, else off in production and on in development |
| `secret` | Key used to keep stored values (AI service keys) encrypted in the DB. Keep it separate from the login signing value. If you change it, re-enter the stored keys. |
| `publicApi` | Optional. Public JSON API (`/api/cms/v1/public/entries`, `/entries/:collection/:slug`; published content only, no login, not cached). `{ collections, filters?: { queryName: relationField }, toJson?(entry, { body }) }` |
| `hooks` | Optional. Hooks on every content write: `transform`, `validate`, `validatePublish` and `afterCommit` (a notification after the change is committed: cache revalidation, webhooks, search indexing). See "Hook contract". Plugins can set `hooks` too |

To use another store or login, build and pass your own `DatabaseAdapter`, `MediaAdapter` or `AuthAdapter`.

### Host trust

A client can send `Host` and `X-Forwarded-Host` itself, so the server does not trust them by default in production. Trusting them means two things: login callback URLs are built from the request host, and the same-origin check accepts the first value of `X-Forwarded-Host`.

- Behind a proxy or on a platform that sets those headers (Vercel, nginx, a load balancer), turn it on with `trustHost: true` in the server config, or `AUTH_TRUST_HOST=true`. The option wins over the variable.
- Otherwise set `AUTH_URL` to the site's public URL. It fixes the origin login uses, so login works without trusting the host. For the same-origin check, set `site.url` so the public host is accepted.
- Default: the `AUTH_TRUST_HOST` variable, else off in production and on in development and tests (the host is `localhost` there). Without it, login on a production server fails with an `UntrustedHost` error (and a warning that names these options).
- Vercel is no longer trusted automatically: add `AUTH_TRUST_HOST=true` to the project's environment variables.

### Login bypass for development

`githubAuth({ devBypass: true })` (`CMS_DEV_AUTH_BYPASS=1` in the generated config) treats the visitor as the first admin without login. It is limited so a staging server cannot be opened by accident:

- `NODE_ENV` must be `development`. In any other mode the flag is ignored and a warning is logged.
- The process must not look deployed: it is refused if a hosting platform variable (`VERCEL`, `NETLIFY`, `CF_PAGES`, `RENDER`, `RAILWAY_ENVIRONMENT`, `FLY_APP_NAME`, `K_SERVICE`, `AWS_EXECUTION_ENV`, `AWS_LAMBDA_FUNCTION_NAME`, `KUBERNETES_SERVICE_HOST`, `DYNO`) is set or `AUTH_URL` points to a public address. In that case the server refuses to start (the login connection throws on first use) with a message that names the reason.
- Each request must come from this machine: `Host` is `localhost`, `*.localhost`, `127.0.0.0/8` or `::1`, and `X-Forwarded-Host` and `X-Forwarded-For` (when present) are loopback too. Other requests have to sign in normally, and a warning is logged once. `isDevAuthBypassEnabled()` from `@monti-cms/core/runtime` is now async and applies the same check.

## Hook contract

Every content write goes through one pipeline in the core services: creating, saving, publishing (one entry or in bulk), duplicating, creating a translation, and a bulk change of metadata or folder.
Hooks are registered in the server config (`defineServerConfig({ hooks })`) or in a plugin's server side (`CmsServerPlugin.hooks`), with the same shape.
The types (`WriteHooks`, `WriteHookContext`, `WriteData`, `ValidationHookContext`, `ValidationResult`, `WriteOperation`) are exported from `@monti-cms/core/server` and `@monti-cms/core/plugin/server`.

```ts
import { defineServerConfig } from "@monti-cms/core/server";

export default defineServerConfig({
	// database, auth, ...
	hooks: {
		// Runs before core preparation. Return the data to prepare (or nothing to keep it as it is).
		transform: ({ operation, collection, entryId, locale, metadata, doc }) => ({
			metadata: { ...metadata, title: String(metadata.title ?? "").trim() },
			doc,
		}),
		// Runs after core preparation, for every write. Failures block the write, warnings come back with the result.
		validate: ({ metadata, snapshot }) => ({
			issues: String(metadata.title ?? "").includes("TODO") ? [{ code: "title_has_todo", path: "title" }] : [],
		}),
		// The same, for a publish only.
		validatePublish: ({ metadata }) => ({ warnings: metadata.summary ? [] : [{ code: "no_summary", path: "summary" }] }),
		// After the change is committed.
		afterCommit: (change) => revalidate(change.collection, change.publishedSlug),
	},
});
```

| Stage | What runs |
|---|---|
| 1 | Build the input: from the request, or from the stored draft (publish, bulk) |
| 2 | `transform` hooks, in registration order (server config first, then the plugins in config order). Each gets the previous one's result |
| 3 | Core preparation: normalization, reference collection, core validation. **Always runs, on the transformed data** |
| 4 | `validate` hooks: extra failures and warnings |
| 5 | Publish only: `validatePublish` hooks: extra failures and warnings |
| 6 | Store commit, one transaction per entry (a bulk change commits item by item) |
| 7 | `afterCommit` hooks |

- `operation` is `create`, `save`, `publish`, `duplicate` or `translate`. A bulk metadata or folder change is a `save` per item, and a bulk publish is a `publish` per item.
  `entryId` is absent while the entry is being created. `metadata` and `doc` (the body as a stored document, `null` for a draft whose body does not parse) are copies: changing them does nothing unless a `transform` returns them.
  `validate` and `validatePublish` also get the prepared `snapshot` (a copy).
- Archiving, trashing, restoring and deleting do not change content, so they skip stages 2 to 5 and still fire `afterCommit`. Restoring a record publishes it again, so its draft gets core preparation, but hooks do not run.
- Hooks run outside the database transaction and get no database client. They may be async. The internal store option `beforePublishCommit` (which does get the transaction's client) is not part of this contract and is unchanged.
- A `transform` that changes the draft while publishing has the change saved together with the publish, in one transaction (`afterCommit` then reports a `saved` change whose status is `published`).
- A hook that throws, or returns something that is not its contract, fails the write with `hook_failed` (HTTP 500). The error names the hook and its owner (`server` or `plugin:<name>`) in `issues[].params`; nothing is stored. `validate` failures give `validation_failed` and `validatePublish` failures give `publish_validation_failed` (HTTP 422), with the added issues next to the draft's own.
- `afterCommit` gets ids, status and slugs only, never the body. Read the committed entry with `getCmsContentStore().getEntry(change.entryId)`. Delivery is in-process and at most once: it is not retried, and there is no outbox yet.

Contracts (each has a test in `src/services/__test__/write-hooks.test.ts` and `write-pipeline.test.ts`):

1. **Transformed data still goes through core.** Normalization, reference collection and validation run on what a `transform` returns, so a transform cannot get a value past a core check.
2. **Extra validation can only add failures.** `validate` and `validatePublish` return issues and warnings that are added to the core ones. They get a copy of the snapshot, so they cannot remove or downgrade a core issue, and the core integrity checks of a publish (references, media, links, required values) always run.
3. **A failure before the commit blocks the write.** A failing core preparation, a failure a hook adds, or a hook that throws stores nothing and does not call `afterCommit`.
4. **An `afterCommit` failure never undoes a completed write.** It is logged, and the other `afterCommit` hooks still run.
5. **Bulk applies the same hooks to every item.** Each item runs the full pipeline, and its result or error (`hook_failed`, `validation_failed`, ...) is reported per item.

## Config

| Item | Meaning |
|---|---|
| `collections` | Collection name → `defineCollection` definition. Names are stored in the DB, so do not change them in production. |
| `locales` | List of content languages (`code`, `name`, admin UI name `label`). |
| `defaultLocale` | Default language (the source of translations). With the default URL scheme, public URLs get no language prefix. |
| `site.url` | Public site URL. Links written as full URLs in the body are also recognized as internal links. May be read from an environment variable. |
| `site.aliases` | Other host names to treat as the same site (e.g. `www.example.com`). |
| `site.name` | Site name shown in the admin UI. If unset, the host name of `site.url`. |
| `site.home` | URL of the admin sidebar `View site` link. A path or full URL. Default `/`. |
| `site.localePrefix` | How the language is added to public URLs. `except-default` (default: the default language as is, other languages as `/{code}`), `always` (`/{code}` for every language), `never` (no prefix). Search previews, draft previews and `localizePath` follow it. |
| `site.previewPath` | Leading part of the draft preview URL (e.g. `/preview`). If unset, there is no preview button. |
| `site.previewLocaleParam` | Query name that carries the language in the preview URL (default `locale`, e.g. `?locale=en`, only when it is not the default language). If `false`, the language goes in the path according to the `localePrefix` rule (`/preview/en/posts/a`). |
| `admin.path` | Admin UI path (default `/admin`). Must match the app's admin route folder. `/` and anything under `/api` are not allowed. Links inside the UI, login redirects and plugin screen URLs follow it. |
| `mdx.syntax` | Syntax extensions (experimental, `@monti-cms/core/syntax`) in writing-precedence order, e.g. `[directiveSyntax()]` from `@monti-cms/syntax-directive`. Stored MDX is standard (CommonMark + GFM + MDX JSX) without them ("Body syntax"). |
| `codeBlock.lineEffects` | Add or override code block line effects ("Code block line effects"). |
| `codeBlock.omitLineEffects` / `features` / `themes` / `languages` | Hide line effects and tools in the editor, set the highlighting themes, and add languages ("Turning code block tools off, themes and languages"). |
| `media` | Media that can be uploaded. `maxImageBytes` (default 10MB), `maxPixels` (default 40 million), `maxFileBytes` (default 50MB) and the accepted formats `imageTypes` (among jpeg, png, webp, gif, avif) and `fileTypes` (among pdf, zip, txt, md, csv, json; an empty list accepts no attachments). The upload API, the admin file picker and `/v1/meta` follow it. |
| `admin.locale` | Admin UI language and date and number formatting (BCP 47, e.g. `en`, `ko-KR`). If unset, the site default language (`defaultLocale`). Times are shown in `timeZone`. |
| `admin.messages` | Override UI text: namespace → key → text. Core block labels are in `"cms.blocks"` (`<block>.label`, like `image.label`), code block effects in `"cms.code-block"`, and validation error texts in `"cms.mdx"`, `"cms.core"` and `"cms.translation"`. |

### Collections

- **Kind (`kind`).** A `document` has a body, separates draft from published content, and is published explicitly. An `item` is a small form whose saved values
  are reflected in the public value immediately (no publishing, archiving or translations; per-language values go in `translations`). The body (`body`), if absent, is used only by documents.
  The old name `workflow: "publish" | "record"` was removed; a config that still has it fails with the `kind` to use (`publish` → `document`, `record` → `item`).
- **Layout (`layout`).** If absent, it is one group in field declaration order, and fields with their own `tab` gather in that tab.
- **List (`list.columns`).** If absent, the default columns. For documents: title, status, language (when there are two or more languages), category field (a relation
  pointing to an item collection), modified date and published date; for items: title, URL (when there is a URL field), language, status and modified date.

A collection's `path` (e.g. `/posts/:slug`) is the shape of the public URL. It is used to recognize internal links in the body (checking before publishing whether the target entry exists and is published)
and by the editor when it creates links. A collection without `path` cannot be linked to from the body.

### Field rules

- **The title field is named `title`; its label is free.** This is a library convention. Every collection has a `title` text field (`fields.text`).
  Lists, search, relation picking, body links, duplication and the title box of the edit screen use this field. The label (`label`) is up to the site (e.g. `Headline`,
  `Name`). There is no separate limit on title length; it follows this field's `max` (no limit if absent).
- **Exactly one URL field.** The URL (`fields.slug`) is a core concept, so there is one per entry. Having two or more URL fields in a collection is a config error.
- **The URL is built from `from`.** With `fields.slug({ from: "title" })`, the URL is built from that field's value until you edit the URL yourself,
  and for an item collection, saving with an empty URL builds it from that value. Without `from`, nothing is built automatically. `from` must be a text field of the same
  collection.
- **Field role (`role`).** Extensions and screens find values by role, not by field name (`roleField(collection, role)`, and `fieldWithRole(schema, role)`, which does not read
  the config). Role names are free (letters, digits, hyphens), and a collection has only one field per role. The only role the core knows is
  `summary` (a text field, the summary). It is passed to field-side actions (AI, etc.) as `summary`. Other roles are decided by the extension that uses them,
  and it checks the field kind in the plugin `validate` (e.g. `seoTitle`, `ogImage`, `noindex` of the SEO extension).
- **Media field.** `fields.media({ label, accept?: "image" | "file" })` picks one file from the media library and stores the media ID
  as text. The value is recorded in media usage (`entry_references`, kind `media`), shows up in the media screen's "Used in" and "Unused" filters,
  and a file in use cannot be deleted. A value that is not a media ID is `invalid_metadata_value`, and an empty value (`""`) means nothing is picked.

- **Required field (`required: true`).** Blocks an empty value when a document collection is published, or when an item collection is saved. Saving a draft is not blocked.
  The old value `required: "publish"` was removed (use `true`); a config that still has it fails with a message.
- **Field value errors.** Error codes are the same regardless of the field. An empty required value is `missing_field` (`null_slug` for the URL), and a length over `max`
  is `field_too_long`. In the issue (`issues`), `path` holds the field name and `message` the field label (the title too). A different relation target
  collection is `invalid_reference_collection`. An empty body (`empty_body`) blocks only collections that use a body (`body`).
- **Fill from the body.** With `fillFromBody: true` (160 characters) or `fillFromBody: { maxLength }` on a text field, an empty value is filled on publish
  with the plain text at the start of the body (only for collections with a body, and never over the field's `max`). The core function is `bodyExcerpt(mdx, maxLength)`. The text is taken from the parsed body, so it follows whatever syntax the site reads: prose, headings, list items, table cells, block bodies and the text attributes of blocks (a callout title); code, math and images are left out. Body search text is built the same way, and also keeps code, image alt text and captions.
- **Multi-line input.** A text field with `multiline: true` is a multi-line input, and `rows` (default 2) sets the initial number of rows.
- **Field names you cannot use.** The key the core uses separately in metadata (`translations`) cannot be a field name.
- **Tabs.** Putting `tab: "name"` on a field or `tab` on a `layout` group creates a tab with that name in the edit screen's properties panel (1 to 20 characters).
  The group's `tab` comes first; if the group has no `tab`, the field's `tab` is used. Fields with their own `tab` gather into one group per tab even without a layout.
  So field groups that extensions provide (e.g. `seoFields()`) land in their own tab even when the site writes no `layout`. If there is none, the default tab
  is `Properties`.
- **View field.** `fields.view({ view: "name" })` is a field that stores no value and draws a view in that spot. The admin extension registers the view
  with `fieldViews` (e.g. `search` of the SEO extension). If no view is registered, nothing is drawn.
- **Swapping the input.** `input: "name"` points at an input that an admin extension registered with `fieldInputs`. Without a registration, the kind's default input is used.
  `inputOptions` (a JSON value) is the setting passed to that input, and the core does not read it (e.g. a recommended length).

```ts
fields: {
	title: fields.text({ label: "Title", required: true }),
	slug: fields.slug({ label: "Slug", from: "title" }),
	excerpt: fields.text({ label: "Excerpt", role: "summary", multiline: true, rows: 3, fillFromBody: { maxLength: 200 } }),
	hero: fields.media({ label: "Hero image", tab: "Media" }),
	credit: fields.text({ label: "Credit", tab: "Media" }),
},
layout: [{ fields: ["title", "slug", "excerpt"] }], // hero and credit gather in the Media tab
```

`defineConfig` throws an error as soon as the app starts if: a relation field points at a collection that does not exist, the default language is not in the list, `title` is missing, there are two or more URL fields,
roles collide or `summary` is not a text field, a tab name is not 1 to 20 characters, `from` or `fillFromBody` does not match the fields,
a field is named `translations`, a collection has no kind, or the shape of `admin.path`, `site.localePrefix`, `site.previewLocaleParam` or `site.home`
is wrong.

Duplicating (`POST /api/cms/v1/entries/:id/duplicate`) sets the copy's title to the `{ title }` in the body if given (the admin UI sends the original
title with " (copy)" appended). Without it, the title is the original's as is. The core does not decide what to append; the copy goes through the same write pipeline as any other write.

## Remaining work

This package was split out of a single blog, so the following needs to be sorted out before using it on another blog.

- The only store is Postgres (`ContentStore`). Using another DB means implementing the same contract, and the contract is still large.

## Development

```bash
pnpm --filter @monti-cms/core test:run
pnpm --filter @monti-cms/core typecheck
```

The package's own tests run with the sample configs `test/cms.config.ts` and `test/cms.server.ts`.

**Tests also run with another site config (regression guard).** `test/other-site.config.ts` is a config deliberately different from the blog's (collections article, topic and author,
field names other than `title` and `slug`, English only, chart + site blocks, no text decorations). In each of the core, admin and AI packages, `vitest.othersite.config.ts` reruns the same
tests with this config (suite names `core (other-site)`, `admin (other-site)` and `ai (other-site)`; the repo-root
`pnpm test:run` runs them together, and in a package use `pnpm test:other-site`). New tests run with both configs automatically. Do not write collection and field names in
tests; look them up from the config (`test/any-site.ts`: collections, relation fields, the second language, and `fillRequiredMetadata`, which fills in publish-required values).
Wrap tests that need something the config lacks (a second language, a bundled block, etc.) in `skipIf`. In the core package, the parts that assert the blog sample data as is
live in `*.blog.test.ts` and are excluded from the other-site run and type check. In the admin and AI packages, list them in `BLOG_FIXTURE_TESTS` of each `vitest.othersite.config.ts`
to exclude them.

**Automated checks (CI).** On every push and PR, `.github/workflows/ci.yml` runs lint (check only), type checking, the package build, tests (Postgres 17 service) and
the example app bundle check (`pnpm example:check`). `pnpm example:check` builds and packs the packages, installs them into the example app in a temporary folder outside the repo,
and runs `tsc` (`skipLibCheck: false`) and `next build` once each with a config that includes all the example config and extensions.
