# @monti-cms/core

English | [한국어](README.ko.md)

The core of a DB (Postgres)-backed blog CMS. It handles the site config, collection schemas, content saving and publishing, the document model, the admin API and plugin wiring.
The admin UI is `@monti-cms/admin`, everything specific to Next.js is `@monti-cms/nextjs`, MDX (the `mdx` format, the source panel and the syntax extensions) is the plugin `@monti-cms/mdx`, and the AI features are the plugin `@monti-cms/ai`. `examples/other-site` is an example with everything wired together.

## Supported frameworks

Next.js (App Router) is the only supported host for now. The code is layered so that this is a property of one package, not of the core or the admin:

- `@monti-cms/core` speaks the standard `Request` and `Response` (`cms.handle(request)`) and imports nothing from Next.js. What a host has to supply (the headers of the current request, a redirect after login) comes in through the login connection (`CmsAuth.requestHeaders` and `CmsAuth.rethrow`).
- `@monti-cms/admin` (the screens and `@monti-cms/admin/hooks`) imports nothing from Next.js either. It reaches the router only through an adapter it is given, `{ Link, navigate, replace, usePathname, useSearchParams }` (`AdminRouterProvider` of `@monti-cms/admin/router`), and the two things its server screens need, a redirect and a 404, through `AdminServer` (`@monti-cms/admin/host`).
- `@monti-cms/nextjs` holds all the Next glue: the route handler, `withCms` for `next.config.ts`, the admin page and layout with the App Router adapter, and the NextAuth login (`githubAuth`).

Another host (Astro, Remix, ...) would be a new adapter package, not a change to the core or the admin. Tests keep the boundary: no source file of the core or the admin may import `next/*`.

## Install in an empty Next app

This assumes a Next 16 (App Router) and React 19 app. The admin needs no Tailwind: its styles are prebuilt, so the app may use any CSS setup. Only Postgres is supported as the store. The order is `monti init` → edit the collections → `monti migrate`.

### 1. Packages

```sh
pnpm add @monti-cms/core @monti-cms/admin @monti-cms/nextjs next-auth@5.0.0-beta.32 next-themes @tanstack/react-query sonner \
  @tiptap/core @tiptap/pm @tiptap/react lucide-react
```

The admin package and the AI plugin must share one copy of React Query, sonner, Tiptap and the lucide icons with the app, so the app installs them (peers).
`next-auth` is only needed when you use GitHub login (`githubAuth` of `@monti-cms/nextjs/auth`).
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
| The CMS instance and its server config (DB, GitHub login; secrets come from environment variables) | `cms.server.ts` |
| Admin UI (the layout imports the prebuilt admin stylesheet) | `app/(admin)/admin/[[...path]]/page.tsx`, `layout.tsx` |
| Admin API and login (`/api/cms/v1/*`, `/api/cms/auth/*`) | `app/api/cms/[...path]/route.ts` |
| Config alias `@cms-config` | added to `paths` in `tsconfig.json` |
| Config wiring (`withCms`) | `next.config.ts` (when it has the default shape with a single `export default nextConfig;` line); created if missing |

For apps that use `src/app`, the config files go in `src/` and the routes under `src/app/`. Files that cannot be edited safely (a `tsconfig.json`
with comments, a next config that does not have the default shape) are left as they are, and what to add is shown as a "to do".
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

`cms.server.ts` creates the CMS instance (`createCms({ server })`, see "The CMS instance"). Its server config holds the store, media and login connections and the secrets, and is only read on the server.
Connections are created on first use, so the environment variables may be empty during the build. To use image uploads, add a store from `@monti-cms/core/s3` to `media` and install the AWS SDK
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
| `CMS_SECRET` | A random long value (different from `AUTH_SECRET`). The master secret that plugins' stored values (AI service keys) are encrypted under (server config `secret`). To change it, keep the old value in `previousSecrets` ("Plugin secrets") |
| `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET` | GitHub OAuth app. The callback URL is `<site URL>/api/cms/auth/callback/github` |
| `CMS_ADMIN_GITHUB_ID` | The admin's numeric GitHub ID |
| `CMS_DEV_AUTH_BYPASS` | Optional. If `1`, requests from your own machine open the admin without login under `next dev` (see "Login bypass for development") |
| `AUTH_TRUST_HOST` | Optional. `true` when the server runs behind a proxy or on a platform that sets `Host` and `X-Forwarded-Host` (Vercel, nginx, a load balancer); see "Host trust" |

```sh
pnpm exec monti migrate
```

It creates the tables or brings them to the latest shape (including plugin tables). Running it several times gives the same result, and you run it again after upgrading the packages.
Core changes are recorded in `cms_migrations` as numbered steps, and only steps that have not run yet are run (in one transaction); even when run concurrently
against the same schema, they run one at a time. A plugin hands over once-only work with `storage.once(name, step)` (see "Plugin storage").
`monti migrate` (and `cms.migrate()`) hand the instance's formats (the ones its plugins provide) to the migration. The old steps that read bodies kept as MDX text need the `mdx` format of `@monti-cms/mdx` only when a store has such a body ("Upgrading from MDX in core").

- Env files: by default `.env.local` and `.env` (only those that exist) are read. Values from the shell win, and earlier files win over later ones.
  Choose files with `--env-file <file>` (repeatable); `--no-env-file` reads none.
- Files: the site config is looked up in this order: `--config` → `CMS_CONFIG_PATH` → the `@cms-config` alias in `tsconfig.json` `paths` → `./cms.config.ts`/`./src/cms.config.ts`.
  The server file, the module that exports the instance as `cms`, is `--server` → `CMS_SERVER_PATH` → `./cms.server.ts`/`./src/cms.server.ts`.
- In a script of your own, import the instance and call it: `import { cms } from "./cms.server"; await cms.migrate(); await cms.close();`
  (run it with `tsx --env-file=.env.local --import @monti-cms/core/register script.ts`, which links the `@cms-config` alias).

### 5. Run

Start it with `next dev` and open the admin path (default `/admin`).

### Login path

By default the GitHub login API is served by the admin API route as well (`/api/cms/auth/*`), so there is no separate login route file.
Apps that still use `/api/auth/*` as before (apps that do not want to change an already registered OAuth callback URL) pick the path and add a route file.

```ts
// cms.server.ts
auth: githubAuth({ /* … */, basePath: "/api/auth" }),

// app/api/auth/[...nextauth]/route.ts
import { cms } from "../../../../cms.server";
export const { GET, POST } = cms.authHandlers;
```

If `basePath` is not the default, the admin API route does not serve `/api/cms/auth/*` (404).

### Optional dependencies

Optional dependencies of the CMS packages (e.g. `mermaid` and `recharts` of the blocks extension) are installed only when you use that feature. For anything not installed, `withCms` (of `@monti-cms/nextjs/config`)
links an empty module (`@monti-cms/core/stubs/missing-optional`) so the build does not stop, and using that feature raises an error telling you to install it.
After installing, restart the dev server.

### Manual wiring (without `monti init`)

To do by hand what `monti init` does: create the site config and the server file (the instance), wrap `next.config.ts` in
`withCms(nextConfig, { config: "./cms.config.ts" })` (`import { withCms } from "@monti-cms/nextjs/config"`), add
`"@cms-config": ["./cms.config.ts"]` to `tsconfig.json` `paths` (and to `resolve.alias` if you use tests (Vitest)),
add the set of route files from the table above (each imports `cms` from the server file), and import the prebuilt admin stylesheet in the admin layout (`app/(admin)/admin/layout.tsx`).

```ts
import "@monti-cms/admin/styles.css"; // prebuilt: needs no Tailwind, typography or tw-animate in the app
```

The stylesheet only affects a document that contains the admin, so the app's own pages keep their look (see "Styles" in the README of `@monti-cms/admin`).

### MDX extension (optional)

```sh
pnpm add @monti-cms/mdx
```

```ts
// cms.config.ts
import { mdx } from "@monti-cms/mdx";

export default defineConfig({
	// …
	plugins: [mdx()], // the `mdx` format and the admin source panel; syntax extensions go in mdx({ syntax: [...] })
});
```

```ts
import "@monti-cms/mdx/styles.css"; // in the admin layout, after "@monti-cms/admin/styles.css"
```

Core stores documents and has no text format of its own: a site without a format plugin accepts documents (`doc`) only, and a text write fails with `unknown_format`. `format: "mdx"` and `?format=mdx` need this package. See the README of `@monti-cms/mdx` for details.

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

```ts
import "@monti-cms/blocks/styles.css"; // in the admin layout, after "@monti-cms/admin/styles.css" (the public page styles are `@monti-cms/blocks/render.css`)
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

```ts
import "@monti-cms/ai/styles.css"; // in the admin layout, after "@monti-cms/admin/styles.css"
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

```ts
import "@monti-cms/seo/styles.css"; // in the admin layout, after "@monti-cms/admin/styles.css"
```

See the README of `@monti-cms/seo` for details.

## The CMS instance

`createCms({ server })` (from `@monti-cms/core/server`) turns the server config into the instance everything on the server uses. The instance owns the content store, services, media store,
login connection, plugin server modules, write hooks and the secret. Nothing is global: two instances with different server configs live side by side in one process (tests, scripts, several databases).
Connections are created on first use, so creating the instance at import or build time connects to nothing.

```ts
// cms.server.ts
import { createCms, defineServerConfig, postgres } from "@monti-cms/core/server";
import { githubAuth } from "@monti-cms/nextjs/auth";

export const cms = createCms({
	server: defineServerConfig({ database: postgres({ /* … */ }), auth: githubAuth({ /* … */ }) }),
});
```

Everything else imports `cms` from this file.

| Where | Code |
| --- | --- |
| Admin API route (`app/api/cms/[...path]/route.ts`) | `export const { GET, POST, PATCH, PUT, DELETE } = createRouteHandler(cms);` (`createRouteHandler` of `@monti-cms/nextjs`, the Next adapter of `cms.handle(request)`) |
| Admin API in another host | `cms.handle(request)`: a standard `Request` in, a `Response` out |
| Admin layout and page | `<CmsAdminLayout cms={cms}>…</CmsAdminLayout>`, `<CmsAdminPage cms={cms} {...props} />` (from `@monti-cms/nextjs/admin`) |
| Site pages (server components, sitemap, RSS) | `cms.read.getEntry(…)`, `cms.read.listEntries(…)`, `cms.read.getTranslations(…)`, `cms.read.getPreview(…)` (pass a `format`, for example `"mdx"` with `@monti-cms/mdx`, to also get the body as text in `entry.body`, "Formats") |
| Public media and links | `entry.refs` (the URLs of the media and the addresses of the internal links of `entry.doc`, drawn by `<CmsContent entry={entry} />`), `cms.read.mediaUrl(mediaId)` |
| Stores and settings | `cms.store()`, `cms.contentService()`, `cms.bulkService()`, `cms.mediaStore()`, `cms.storage(pluginName)`, `cms.secrets(pluginName)`, `cms.auth()`, `cms.authGateway`, `cms.authHandlers`, `cms.isMediaConfigured` |
| Scripts and the command line | `cms.migrate()`, `cms.close()` |
| Plugin routes | `adminRoute(async ({ request, params, auth, cms }) => …)`: the route gets the instance that serves it |
| Tests | `fakeCms({ store, verifyAdmin, … })` from `@monti-cms/core/testing`: a real instance over the parts the test provides |

**HTTP layer.** The admin API, the login connection, the public API and the plugin routes work on the standard web `Request` and `Response`; no `NextRequest`, `NextResponse` or `request.nextUrl` is used.
`cms.handle(request)` serves one request (the path after `/api/cms/` is read from the URL), and `createRouteHandler(cms)` of `@monti-cms/nextjs` is the thin Next adapter built on it.
Plugin routes (`adminRoute`) receive a standard `Request`: read the query with `new URL(request.url).searchParams` and answer with `Response.json(…)`.
The core imports nothing from Next.js. What a host supplies reaches it through the login connection: `CmsAuth.requestHeaders()` (the headers of the request being handled, which the development login bypass reads) and `CmsAuth.rethrow(error)` (lets a redirect that the login library throws pass through to the host). `githubAuth` of `@monti-cms/nextjs/auth` provides both with Next's own functions; an `AuthAdapter` for another host provides its own.

The reading API hangs off the instance (`cms.read.getEntry(…)`, not `getEntry(cms, …)`): site code imports one thing, and its types (`MetadataFor` and so on) stay in `@monti-cms/core/read`.

**Development reload.** `next dev` evaluates `cms.server.ts` again after an edit, which calls `createCms` again, and a new database adapter would open a second connection pool without closing the first.
So, in development only (`NODE_ENV=development`), an instance reuses the database adapter (and the media store) of the first instance created with the same `id` (default `"default"`),
kept under one `Symbol.for("monti.cms.dev-connections")` entry on `globalThis`. Everything else (store, services, login connection, plugins, hooks, secret) is rebuilt from the new server config, so edits to hooks and options take effect.
Changing the database connection itself needs a restart. In production and in tests there is no such cache: an instance owns its connections alone. If one development process creates more than one instance, give each its own `id`: `createCms({ id: "reports", server })`.

**Still read through the `@cms-config` alias.** The site config (collections, locales, plugins, blocks) is still linked by the `@cms-config` alias for now, so one process has one site config. `createCms` takes only the server side.

### Upgrading to `@monti-cms/nextjs`

All Next-specific code moved out of `@monti-cms/core` and `@monti-cms/admin` into the new package `@monti-cms/nextjs`. There are no aliases left at the old places.

- Install `@monti-cms/nextjs` (`next` and, for GitHub login, `next-auth` are its peers; core and admin no longer ask for them).
- `next.config.ts`: `import { withCms } from "@monti-cms/core/next"` becomes `from "@monti-cms/nextjs/config"`.
- `cms.server.ts`: `githubAuth` moves from `@monti-cms/core/server` to `@monti-cms/nextjs/auth`.
- `app/api/cms/[...path]/route.ts`: `cms.routeHandler()` becomes `createRouteHandler(cms)` from `@monti-cms/nextjs`. The `CmsRouteHandler` type is exported from there too.
- Admin layout and page: `@monti-cms/admin/next` becomes `@monti-cms/nextjs/admin` (`CmsAdminLayout`, `CmsAdminPage`, `CmsAdminPageProps`, `cmsAdminMetadata`; same props). The layout renders the App Router adapter for the admin.
- Admin messages: the page title keys moved from the `cms-admin.next` dictionary to `cms-admin.layout` (only matters if you override `admin.messages["cms-admin.next"]`).
- Your own `AuthAdapter`: `CmsAuth` has two optional members, `requestHeaders()` and `rethrow(error)`. Without `requestHeaders`, the development login bypass never applies.
- Mounting the admin screens some other way than `CmsAdminLayout`: wrap them in `NextAdminRouter` (`@monti-cms/nextjs/admin`), or in `AdminRouterProvider` with your own adapter.

### Upgrading from the `@cms-server` alias

- `cms.server.ts` no longer default-exports the server config. Wrap it: `export const cms = createCms({ server: defineServerConfig({ … }) })` (`createCms` is in `@monti-cms/core/server`).
- Remove `"@cms-server"` from `tsconfig.json` `paths` and from Vitest `resolve.alias`. `withCms(nextConfig, { config })` takes no `server` option any more.
- Plugin routes and custom admin routes get a standard `Request` instead of `NextRequest`: replace `request.nextUrl` with `new URL(request.url)` and `NextResponse.json` with `Response.json`.
- The admin API route is `createRouteHandler(cms)` of `@monti-cms/nextjs` (see "Upgrading to `@monti-cms/nextjs`").
- Pass the instance to the admin: `<CmsAdminLayout cms={cms}>` and `<CmsAdminPage cms={cms} {...props} />` (the page file becomes a small component; `monti init` shows the shape).
- Site pages read through `cms.read.*` instead of the free functions of `@monti-cms/core/read`; `entry.refs` replaces `createPublicImageResolver(mdx)` (`cms.read.imageResolver` is gone too, "Upgrading from MDX in core") and `cms.read.mediaUrl(id)` replaces `resolvePublicMediaUrl(id)`.
- Gone: `getCmsContentStore`, `getCmsMediaStore`, `getCmsSecret`, `getCmsDatabase`, `loadServerPlugins` and the login free functions of `@monti-cms/core/runtime` (`authGateway`, `auth`, `signIn`, `signOut`, `handlers`, `isDevAuthBypassEnabled`, …). Use the instance:
  `cms.store()`, `cms.mediaStore()`, `cms.secrets(pluginName)`, `cms.storage(pluginName)`, `cms.plugins()`, `cms.auth()`, `cms.authGateway`, `cms.authHandlers`.
  Nothing hands out the raw master secret any more (`cms.secret` and `cms.server.secret` are gone too); see "Plugin secrets".
  A plugin's route gets `cms` in its handler input, `CmsServerPlugin.features(cms)` and `migrate(storage, cms)` get it as an argument, and hooks read it from a closure over your own `cms`.
- `@monti-cms/core/migrate` is gone: run `monti migrate`, or `await cms.migrate()` in a script. `monti migrate` now imports the server file and need it to export `cms`.
  `@monti-cms/core/register` links only the `@cms-config` alias.
- Signing in and out are plain form posts to `/api/cms/v1/session/*`, not server actions (a server action cannot carry the instance). Nothing to change in apps.

### Upgrading plugins that used `cms.database()`

- `cms.database()`, `PluginDatabase` (with its `pool` and `once`) and `withTransaction` are gone from `@monti-cms/core` and `@monti-cms/core/plugin/server`. A plugin keeps its data in `cms.storage("<plugin name>")` (see "Plugin storage") and its `migrate(db, cms)` becomes `migrate(storage, cms)`.
- A plugin that created tables of its own has to move that data once. Do it inside `storage.once(name, step)` with `migration.readLegacyTable(table)` and `migration.importItem(...)`; the old tables are only read, so they stay as a backup. The AI plugin did this (see its README).
- Run `monti migrate` when you deploy: it creates the `plugin_documents` table and moves the AI plugin's data. Instances of the old version still write the old AI tables, so replace them all at the same time.
- `createContentLookup(cms.database())` is `createContentLookup(cms)`. `createContentStore` and `migrateContentStore` are no longer exported from `@monti-cms/core/runtime`; tests take them from `@monti-cms/core/testing`.
- Types such as `Entry`, `ListEntriesParams` and `CmsError` come from `@monti-cms/core/runtime` as before; they are defined in `src/core/store`, not in the Postgres adapter.

### Upgrading from MDX in core

MDX moved out of core into the package `@monti-cms/mdx`. Core has no MDX dependency any more (`next-mdx-remote`, `remark-*`, `rehype-*`, `unified`, `vfile` and the mdast types are gone from its `package.json`). Do this **before** deploying this version:

1. Install `@monti-cms/mdx`.
2. Add `mdx()` to `plugins` and **move** `mdx.syntax` into it: `defineConfig({ mdx: { syntax: [directiveSyntax()] } })` becomes `plugins: [mdx({ syntax: [directiveSyntax()] }), ...]`. Keep the same options (for a site that wrote directives, `directiveSyntax()` with write mode on). The `mdx` config key is gone.
3. Import `@monti-cms/mdx/styles.css` in the admin layout, after `@monti-cms/admin/styles.css`.
4. Replace `renderMdx` imports from `@monti-cms/core/render` with `@monti-cms/mdx/render` (or render documents with `CmsContent`), and `cms.read.imageResolver(...)` with `entry.refs` (`renderMdx(source, { refs: entry.refs })`). `renderMdx` returns `{ content, toc, unknown }` and compiles or executes no MDX.
5. Replace imports of `@monti-cms/core/mdx`, `@monti-cms/core/syntax` and `@monti-cms/core/format/mdx`, which are removed: the syntax extension interface (`SyntaxExtension`, `SerializeContext`, `RAW_SOURCE_PARAGRAPH`, the table and comment syntax helpers) comes from `@monti-cms/mdx`, and the parser and writer (`analyze`, `serialize`, `toDocument`, `bodyFromMdx`, `mdxFormat`, ...) from `@monti-cms/mdx/format`. Syntax extension packages peer on `@monti-cms/mdx` now.
6. Block extensions you wrote: drop the default export of your `render` modules and keep `documentComponents` (`CmsPlugin.render` returns `{ documentComponents }`).
7. Run `monti migrate`. With `mdx()` in the config, an old database upgrades with the right syntax extensions. Without it, a store that still has bodies to read through the old steps fails with a message that says to install `@monti-cms/mdx` and add `mdx()` to the plugins of the site config.
8. Drop `monti content:rewrite` from your scripts: it is removed (`cms.rewrite` too), since there is no stored text to normalize.

What else changed:

- **No built-in format.** A site without a format plugin accepts documents (`doc`) only, and a text write fails with `unknown_format`. `format: "mdx"` and `?format=mdx` need `@monti-cms/mdx`.
- **Database.** `entry_bodies.mdx` and `body_templates.mdx` are nullable (the step `0020_mdx_columns_optional`, which runs before `seed_initial_body_templates`) and are no longer written. The columns are not dropped, so old rows keep their text. The media in-use check looks in `doc`.
- **Old steps.** `0010`, `0011`, `0012`, `0013` and `0015` keep their names in core but parse through the `mdx` format that `@monti-cms/mdx/server` supplies (`CmsFormat.legacyBodies`, "Formats"). They need the package only when a store actually has a body to read through them: a fresh store, and a store already past those steps, never need it at migrate time. `monti migrate` and `cms.migrate()` pass the instance's formats to the migration, so a site that lists `mdx()` migrates old data with its syntax extensions.
- **Rendering.** `renderMdx` and `compileMDX` are not in `@monti-cms/core/render` any more: core renders documents (`CmsContent`, `renderDocument`). Block extensions export only `documentComponents` from their render modules, and `@monti-cms/blocks` has no MDX component tables.
- **Admin.** The source panel is registered by the `mdx()` plugin (without it, there is no source toggle), and its message namespace is `cms-mdx.source` (it was `cms-admin.mdx-source`). The admin exports `SOURCE_ERROR_ID` and `useLinkPaths` (`@monti-cms/admin/hooks`); `mdxBrowserFormat` is no longer exported by `@monti-cms/admin/editor`. Recovery copies that browsers saved before documents existed are kept as an `unparsed` document, which the panel reads again.
- **AI.** `@monti-cms/ai` peers on `@monti-cms/mdx`: its model reads and writes MDX through the `mdx` format.
- `@monti-cms/core/notation` is a new light entry (comment syntax and table helpers for notations).

## Components as source

`monti add <name...>` copies ready-made components from the Monti registry into your app as source you own: a public `article-body` (the stored document and a table of contents),
an admin `entry-editor` screen built on `useEntryEditor` and `useField`, a block edit view for `blockViews`. Imports are rewritten to your alias (`components.json` or `@/components`), the npm packages they
need are installed with your package manager, and a file you changed is never overwritten unless you pass `--overwrite`.

```sh
pnpm exec monti add article-body              # -> components/monti/article-body/article-body.tsx
pnpm exec monti add entry-editor --dry-run    # show the plan, change nothing
pnpm exec monti add article-body --registry ./registry/r   # another registry (folder or URL)
```

The registry follows the shadcn registry schema and lives in `registry/` of the repository (built into `registry/r`, committed). The components use the host's Tailwind and only public entry points
(`@monti-cms/admin/hooks`, `@monti-cms/core/render`, `@monti-cms/core/client`, `@monti-cms/nextjs`). `examples/other-site` installs `article-body` this way and uses it on its article page.
Full reference, the list of components and how to add one: [`registry/README.md`](../../registry/README.md).

## Entry points

| Entry point | Used in | Contents |
| --- | --- | --- |
| `@monti-cms/core` | `cms.config.ts` | `defineConfig`·`defineCollection`·`fields`·`defineBlock`·`definePlugin` |
| `@monti-cms/core/server` | `cms.server.ts` | `createCms`, `defineServerConfig`, `postgres`, store contract types (`MediaStore`, etc.). Store modules are loaded on first use |
| `@monti-cms/core/s3` | `cms.server.ts` | `r2Storage`, `s3Storage` (S3 API media stores; the AWS SDK is an optional dependency) |
| `@monti-cms/nextjs` | `app/api/cms/[...path]/route.ts` | `createRouteHandler(cms)` |
| `@monti-cms/nextjs/config` | `next.config.ts` | `withCms` |
| `@monti-cms/nextjs/admin` | admin route files | `CmsAdminLayout`, `CmsAdminPage`, `cmsAdminMetadata`, `NextAdminRouter` |
| `@monti-cms/nextjs/auth` | `cms.server.ts` | `githubAuth` |
| `@monti-cms/core/render` | public pages (server components) | `CmsContent`, `renderDocument(doc, options)` → `{ content, toc, unknown }`, `tableOfContents(doc)`, the component prop types ("Rendering a stored document"). MDX text is drawn by `renderMdx` of `@monti-cms/mdx/render`. In the site CSS: `@import "@monti-cms/core/render.css";` |
| `@monti-cms/core/read` | public pages (types) | `ReadEntry`, `MetadataFor` and the other types of `cms.read`, which reads published content (`getEntry`, `listEntries`, `getTranslations`, `getPreview`: relations, URLs, old-URL redirects, source fallback) |
| `@monti-cms/core/runtime` | server code (including cron scripts and site tests) | store and service types, login types, snapshot helpers. It does not use `server-only`, so it can be loaded outside Next (`tsx --import @monti-cms/core/register`) |
| `@monti-cms/core/client` | UI code | API shapes, collection, locale, URL, block and schema helpers |
| `@monti-cms/core/code-block` | public renderer, editor | The code block annotation model |
| `@monti-cms/core/document` | screens and plugins that edit or inspect a body | The `StoredDocument` type and the helpers that work on a document without knowing its notation: block ids (`assignBlockIds`, `isBlockId`, `withoutBlockIds`), `canonicalDocument`, `readStoredDocument`, `emptyStoredDocument`, `unparsedDocument`, link, image and table helpers, the stored code block model. Nothing in it parses or writes a text notation. The admin editor and AI import from here |
| `@monti-cms/core/format` | plugins that add a format | `defineFormat`, the `CmsFormat` interface with its context and issue types, `createFormatRegistry` ("Formats"). It does not read the site config, so a plugin may import it anywhere |
| `@monti-cms/core/notation` | format and syntax extension packages | A light entry with the helpers a notation builds on: the code comment syntax (`resolveCommentSyntax`, `formatAnnotationComment`) and the table helpers. `@monti-cms/mdx` re-exports them for syntax extensions |
| `@monti-cms/core/plugin/server` | server side of plugins | route scaffolding (`adminRoute` hands the route the `cms` instance), the `Cms` type, errors |
| `monti` (command line, package `bin`) | terminal | `monti init` (create files), `monti add` (install components as source), `monti migrate` (create tables) |
| `@monti-cms/core/cli` | command-line tooling | `runCli`, `initProject`, `addComponents`, `migrate` (the code behind the `monti` command) |
| `@monti-cms/core/register` | custom scripts | links the `@cms-config` alias for a script run with `tsx --import` |
| `@monti-cms/core/testing` | tests | `fakeCms` (an instance over the parts a test provides), isolated-schema DB, sample data. Helpers that need MDX text are in `@monti-cms/mdx/testing` |

## Building the packages

Inside the repository the sources (`src`) are used directly. For the distributable bundle, `pnpm build:packages` produces `dist` and `pnpm pack` packages it using
`publishConfig.exports` (dist). `pnpm example:pack` puts the bundle into `examples/other-site/vendor`.

## Body syntax

Core stores a body as a document and does not read or write any text notation. A notation is a **format** ("Formats"), and MDX is the format of the package [`@monti-cms/mdx`](../mdx): what is written by default (line breaks, tables, images, blocks as JSX), the *syntax extensions* that add a notation
(`@monti-cms/syntax-directive` for `:::callout`, `@monti-cms/syntax-shiki` for Shiki code notation), and how to write one are described in its README. Syntax extensions are listed in `mdx({ syntax })` in `plugins`, not in a config key of core.

#### Stored bodies

Every body (the working and published bodies of entries, the source a translation was confirmed against, and body templates) is stored as a versioned **document** (`entry_bodies.doc`, `body_templates.doc`: the parsed body as JSON). The document is the only source: nothing writes text next to it. The `mdx` columns of `entry_bodies` and `body_templates` are optional (`0020_mdx_columns_optional`) and are never written; they are not dropped, so old rows keep their text.
Saving a body in another spelling of the content it already has changes nothing (no new version). A text typed in a source panel (the `mdx()` plugin provides one) is read in the browser into a document, and the document is what is saved.
A body that cannot become a document (its text does not parse, has front matter, or would not read back the same) is stored as an **`unparsed`** document: one node `{ "type": "unparsed", "attrs": { "format": "mdx", "source": "<the text as given>" } }`, which keeps the text exactly. A draft can hold it, the editor shows it as source, and publishing it is blocked by the issue `unparsed_body`. The reasons it was rejected (`mdx_error` with the line and column in the text, `frontmatter_present`) are reported next to it.

**What is checked.** Core checks, hashes and searches the stored document, never a text, so a body is treated the same however it was written or sent. Those are `prepareSnapshot` and `validateForPublish` (required, unknown and invalid block attributes, references, internal links, image sources, footnotes, code-line links, table merges, translation notes left in the text), the content hash (`computeContentHash(metadata, doc, schemaVersion)`, the same value as before: the document without block ids, keys sorted), the search text and excerpts (`documentText(doc, options)`, `bodyExcerpt(doc, maxLength)`) and the translation helpers (`withTranslationHints`, `compareStructure`, `diffSources` take documents). A body given as text is read into a document by its format first, and a document is taken as given (its text runs and trailing blank paragraphs are put in their canonical form).
Where a finding is, is the block it is in: an issue's `position` is `{ blockId }` (a text that could not be read has `{ line, column }` in that text instead), and a body reference occurrence is `{ "type": "body", "blockId" }`.

**Code blocks.** A code block is stored as its code (without annotation comments) and its annotations as data (line effects, text effects and regex rules), and a text format writes it back as Monti annotation comments, so other tools that read the text still see them.
`monti migrate` runs the step `0015_code_annotations`, which converts existing documents (including the document a translation was confirmed against) and rewrites the annotation comments of code fences in their canonical form (`// @line plus` becomes `// @line plus {0-0}`, rules for the whole code come first). It recomputes the content hash and search text, which no longer holds annotation comments; `version` and `updated_at` do not change. It reads old text through the `mdx` format only when a store has such a body ("Upgrading from MDX in core").

**Block ids.** Every block of the document has an `id` (8 characters of base36) that is unique within the body. It says which block is which across versions: it is not written to a text format and is not part of the content hash, so it never counts as a change.
A body saved as text inherits ids from the version it replaces: a block that reads the same keeps its id, and so do edited, split and moved blocks (the first part of a split paragraph keeps it); blocks with no partner get new ids, and a document sent through the API keeps the ids it carries.
`monti migrate` runs the step `0014_block_ids`, which gives the existing documents their ids (and gives a published body the ids of the working blocks it shares); it changes only `doc`, never the text, the hash, `version` or `updated_at`.
The admin editor works on the document itself (no notation in between): it keeps every block's id while you edit and always saves a document, so blocks keep their ids exactly; text typed in a source panel is read in the browser into the document it reads as, whose blocks are paired with the body it replaces as above. Applying a template to an entry copies the template's document with new block ids (ids are unique within one body, and the translation and diff views pair blocks by them).
The ids are what the admin uses to point at a block: a publish issue or reference position names its block (`position.blockId`) and opens it in the visual editor, the translation screen compares the source a translation was confirmed against with the current source block by block (a block that only moved shows as moved), and AI translation finds the block it translates by its id.

**Upgrading.** The step `0013_stored_documents` adds the `doc` columns and gives every existing body its document, reading its old text through the `mdx` format of `@monti-cms/mdx` with the syntax extensions of `mdx({ syntax })` ("Upgrading from MDX in core"). It rewrote the old text in the site's notation at the time, so the stored text of many bodies changed at once; `version` and `updated_at` did not.
Bodies that do not parse, have front matter or would not read back the same are left as they are, without a document, and each is logged (`[monti] no stored document for …`); the step `0017_unparsed_bodies` then gives them their `unparsed` document (below). Back up the database first and read the log after the run.

`monti migrate` also runs `0017_unparsed_bodies`: every body and template that has no document gets the `unparsed` document of its text, its content hash is recomputed (text that is not a document is hashed as it always was, under its own tag), and the translation state of every translation is lifted to version 4 (`{ version: 4, baseDoc }`, the document of the source it was confirmed against; versions 2 and 3, which held the source's MDX, are still read). `mdx`, `search_text`, `version` and `updated_at` do not change.
Nothing fails because of such a body, published ones and templates included, since the data of an existing store always migrates. The published bodies and templates among them are logged by id (`[monti] N published bodies have no document …`): they read as unparsed (a page renders it as nothing) until you fix them in the editor.
**Reference occurrences.** A body occurrence of a stored reference used to be `{ "type": "mdx", "line", "column", "blockId"? }`. Reads accept both shapes, and the next save of the entry writes the new one (`{ "type": "body", "blockId" }`); there is no SQL migration for them.

- **Admin entry API.** `POST /api/cms/v1/entries` and `PATCH /api/cms/v1/entries/:id` take the body as `doc` (the document JSON as read back from `working.doc` / `published.doc` of an entry) or as `body` (a text) with the `format` that reads it ("Formats"); `mdx` is gone. Sending a document and a text together, a text without its format, or a document that is not a valid stored document is `400 invalid_input`. With none of them, a new entry has an empty body and a patch keeps the current one.
  Sending back the `doc` that was read changes nothing. `GET /api/cms/v1/entries/:id?format=<name>` adds `body` (a string) to `working` and `published` (and to the source of a translation): the document as text in that format, written to be imported again. `GET /api/cms/v1/meta` reports the size limits as `limits.textBytes` (a text, in any format) and `limits.docBytes`, and the formats of the instance as `formats` (`{ name, label, mimeType, extension, canImport }`). The admin editor always sends `doc`.
- **Template API and templates.** A body template is a document like an entry body: `body_templates.doc` is its only source and nothing writes `body_templates.mdx` any more (the column stays, optional). `POST /api/cms/v1/templates` and `PATCH /api/cms/v1/templates/:id` take `{ name, doc }` or `{ name, body, format }` (with neither, a template is empty; a patch keeps the body), and answer with `doc` and no `mdx`; `?format=<name>` on a `GET` adds `body` to each template. A text the format rejects is `422 format_import_failed` with the format's findings, because a template, unlike an entry draft, has no place to keep text that is not a document.
  The admin template manager and the template menu of the editor work on documents. Applying a template copies its document into the entry with new block ids. Seed templates (`seed.templates` in the site config) are `{ id, name, doc }` or `{ id, name, body, format }`; a text is read by its format when the migration seeds a new store, and a seed that no installed plugin can read stops the migration with a message that names the format (for `mdx`: install `@monti-cms/mdx`). Nothing like that stops a store that already has its data.
  `monti migrate` runs `0019_templates_documents`: a template that has no readable document gets the `unparsed` document of its text, and `body_templates.mdx` stops being required. `version`, `updated_at` and the text already in the column do not change; nothing fails because of a template, and the ones that had no document are logged by id. Running it again changes nothing.
- **Admin export** (`GET` or `POST /api/cms/v1/export`) is format version 4. The archive holds the documents: `working.doc.json` / `published.doc.json` for each body, `templates.json` items with `doc`, the public archive's `published.json` with `doc`, and the digests cover them. It has no MDX of its own; `format=<name>` (in the query, or `format` in the body of a `POST`) also writes each body as `working.<extension>` / `published.<extension>` and each template as `body` in that format, and `manifest.format` names it. The admin archive's texts are written to be imported again (a link to an entry that cannot be resolved keeps its id); the public archive's are for readers (it has published entries only, and an unpublished target is not a link). An unknown format is `400 unknown_format`.
- **Public read API and public export** return the document. `cms.read.getEntry` / `listEntries` / `getPreview` give `entry.doc` (the stored document; in a list only with `body: true`, otherwise `null`) and `entry.refs`
  (`{ media: { [mediaId]: { url, width?, height?, file? } | { failure } }, links: { [entryId]: { path, title, locale } } }`: what a renderer needs for the images, files and internal links of that document, only for what the document uses; `collectRefs(doc)` lists the ids).
  A link in a document is `{ entryId }` (internal) or `{ href, title? }` (external). `entryId` is the translation group id (the source entry's id, the same id a relation holds), so `refs.links` gives the address and title in the reader's language and falls back to the source's;
  a link whose target is not published is not in `refs.links` and is drawn as plain text. Renaming a slug changes nothing in the stored document. Links are references like relations: they are in the references of the entry, block by block, and a link to an entry that does not exist (or an address nobody holds) blocks publishing (`unresolved_internal_link`). A link to an entry that is not published, or is in the trash, only warns (`unpublished_internal_link`): the page draws it as plain text until the target is published, so posts that link to each other can be published in any order.
  Text written with the address of a post (`[x](/posts/slug)`, in any format or in a document) is turned into a link by id when it is written, if an entry holds that address; an address no entry holds stays as written and blocks publishing. Migration `0018_link_entry_ids` does this for the stored documents of an existing database (document version 3).
  `entry.mdx` is gone: pass `format: "mdx"` and read `entry.body` (`{ format, text }`, "Formats"). `GET /api/cms/v1/public/entries/:collection/:slug` returns `doc` and `refs`, and with `?format=<name>` also `body: { format, text }` (an unknown format is `400 invalid_input`); lists have none of them.
  A draft that could not become a document previews with its `unparsed` document.

### Writing a syntax extension (experimental)

The `SyntaxExtension` interface (`remarkPlugins`, `fromDocument`, `fromMark`, `escapeText`), `SerializeContext`, `RAW_SOURCE_PARAGRAPH`, the table helpers and the code comment syntax helpers are exported by `@monti-cms/mdx`, and described in its README ("Writing a syntax extension"). Core only provides the light entry `@monti-cms/core/notation` that they build on.

## Formats

The stored document is the only source of a body. A **format** is a notation it can be written as and, when the format can, read from: MDX, Markdown with Hugo front matter, plain text. Formats are plugins reached through the `format` option of the read and write APIs: the plugin converts, and core validates and stores. Anyone can write one. Core has no built-in format: the `mdx` format is provided by `@monti-cms/mdx`. A site without a format plugin accepts documents (`doc`) only, and a text write fails with `unknown_format`.

```ts
import { defineFormat } from "@monti-cms/core/format";

export default defineFormat({
	name: "hugo", // the value of the `format` option: lowercase letters, digits and hyphens
	label: "Hugo Markdown",
	mimeType: "text/markdown",
	extension: "md",
	// Document → text. Pure: no database, no network, no site config.
	export(doc, ctx) {
		return "…";
	},
	// Text → document. Leave it out for a one-way format (one that can only be written).
	import(text, ctx) {
		return { ok: true, doc, warnings: [] }; // or { ok: false, issues: [{ code, position: { line, column } }] }
	},
});
```

A plugin provides formats with a lazy loader, like `server` and `render`: `definePlugin({ name: "hugo", formats: () => import("./formats") })`, whose default export is a format or a list of them. A name provided twice fails when the instance loads its plugins. `cms.formats()` is the registry of one instance, and `GET /api/cms/v1/meta` lists it as `formats`.

**Legacy bodies.** A format may also give `legacyBodies` (the `LegacyBodies` type of `@monti-cms/core/format`): how to read and write the text that old stores kept bodies in (`read`, `write`, `insertSoftBreaks`, `documentOf`). Only the `mdx` format has it (`@monti-cms/mdx/server` supplies it). The migration steps `0010`, `0011`, `0012`, `0013` and `0015` keep their names in core but parse through it, and ask for it only when a store has a body to read ("Upgrading from MDX in core").

**What a format gets.** Both directions get `ctx.locale`, `ctx.blocks` (the body blocks of the site) and `ctx.codeLineEffects`. `export` also gets `ctx.purpose` (`"read"`: a consumer reads the text, so it needs addresses that work outside the database; `"sync"`: it will be imported again, so a two-way format keeps what it needs to round-trip), `ctx.link(entryId)` (`{ url, title, locale }`, the current address of the entry a link points to, or `null`), `ctx.media(mediaId)` (`{ url, width?, height?, filename, mimeType, byteSize }` or `null`) and `ctx.report(issue)` for what it could not write as the document says. Core resolves every link and media item of the document before it calls `export`, so these are plain synchronous lookups.
`import` returns the document the text says without caring about block ids or the document version: core gives every block an id (pairing it with the body the text replaces, so unchanged blocks keep theirs) and puts the document in its canonical form. A warning may name a block of the returned document by `blockIndex`; core turns it into the block's id.

**What core does for every format.**
- *Export:* an internal link is written as the **real path of its target** (`ctx.link(entryId)`, for MDX `[x](/en/posts/slug)`), never as `entry:<id>`, so the files work in Astro, Hugo and git-sync, and the path follows the target when its slug changes (the document does not change). A link whose target is gone or not published is dropped (the label stays) in a text for readers (`read`), and keeps its id (`entry:<id>` in MDX) in a text to be imported again (`sync`). A registered image is its public URL for `read`, and keeps its `mediaId` for `sync`.
- *Import:* a link written as the address of this site's content (`/posts/slug`, with or without the locale prefix) becomes a link by entry id when an entry holds that address, and an image whose `src` is the public URL of a registered media file becomes that file (`mediaId`). What nobody holds stays as written (publishing reports an address nobody holds as `unresolved_internal_link`). A text exported by a format imports back to the same ids.
- *Validation and storage* are core's: what a format returns is checked and stored like a document sent directly (`prepareSnapshot`, write hooks, the content hash, references), so a format cannot get past a core rule. A text the format rejects (`ok: false`) is not lost: a draft keeps it as an `unparsed` document (`{ "type": "unparsed", "attrs": { "format", "source" } }`) with the format's findings as issues, and publishing is blocked until it is fixed ("Stored bodies").

**The `format` option.**

| Where | How |
| --- | --- |
| `cms.read.getEntry`, `listEntries` (with `body: true`), `getPreview` | `format: "mdx"` adds `entry.body = { format, text }`. Links are the paths readers see (an unpublished target is not a link) and images are public URLs. An unknown format throws a `ServiceError` coded `unknown_format` |
| `GET /api/cms/v1/public/entries/:collection/:slug` | `?format=mdx` adds `body: { format, text }` |
| `POST /api/cms/v1/entries`, `PATCH /api/cms/v1/entries/:id`, `cms.contentService()` (create, save, bulk) | the body is `{ doc }` or `{ body, format }`, never both |
| `GET /api/cms/v1/entries/:id` | `?format=mdx` adds `working.body` and `published.body` (strings) |
| `/api/cms/v1/templates` | `{ name, doc }` or `{ name, body, format }`; `?format=` on a `GET` adds `body` |
| `GET` or `POST /api/cms/v1/export` | `format=mdx` also writes the bodies as files of that format |

| Error code | Status | When |
| --- | --- | --- |
| `unknown_format` | 400 (public API: `invalid_input`) | no plugin provides the format |
| `format_not_importable` | 400 | a write with a one-way format |
| `format_import_failed` | 422 | the format threw or returned something that is not a document (its own message is only logged), or a template's text was rejected (`issues` carry the positions in the text) |
| `format_export_failed` | 500 (public API: 503 `unavailable`) | the format threw |
| `body_too_large` | 413 | a text over `limits.textBytes` (2 MiB) or a document over `limits.docBytes` (8 MiB) |

**Upgrading from the `mdx` property.** There are no aliases. Send `{ doc }` or `{ body, format: "mdx" }` instead of `{ mdx }` to the write APIs and `createDraft` / `saveDraft`; read `entry.body.text` (with `format: "mdx"`) instead of `entry.mdx`; the template API and `seed.templates` take `doc` or `{ body, format: "mdx" }`; `limits.mdxBytes` is `limits.textBytes` and the error `mdx_too_large` is `body_too_large`. The text that exports write for an internal link is the target's path, where the old `mdx` column, which nothing writes any more, held `entry:<id>`. The built-in `mdx` format is gone: it comes from `@monti-cms/mdx` ("Upgrading from MDX in core").

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
		component: "Notice", // the name of the block in a text notation (the JSX name in MDX); the public page draws it with the component registered for the block name
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
		component: "Graphviz", // the public page draws it with the component registered for the block (it gets the code as `source`)
		attributes: {},
		editor: { view: "node", insertable: true, insert: { code: "digraph { a -> b }" }, placeholder: "Enter Graphviz code" },
	}),
],
```

- The blocks you can add are element blocks (`container`, `leaf`; stored as MDX JSX elements named by `component`, and also as directives with the directive extension, where `directive` is the directive name; see `@monti-cms/mdx`), text decorations (`text` + `editor.view: "mark"`) and code fence blocks (`fence`).
  A code fence block takes over every code fence of that language, so do not use a common code language name (such as `ts`).
- A text decoration is stored as `<Component attributes>text</Component>` (`:name[text]{attributes}` with the directive extension). Attributes are written in definition order; required attributes (`required`) are written even when empty, and the rest
  only when they have a value. Nested decorations are stored in the order they were added (outermost first). The admin package builds the editor display from the definition, and the look, formatting
  toolbar, bubble and slash menu are registered in the admin UI by the extension ("Text marks" in the `@monti-cms/admin` README). An attribute with `codeAnchor: true`
  makes its value the code block line label (the `anchor` line effect), and the editor's body–code linking uses this decoration (only one per site).
- Choice values, required values and child values (`childValue`, e.g. the tab to open first is one of the tab names) of attributes, and the number of children (`children.min`, `max`) are
  validated before publishing.
- Removing a block that was in use drops it from the stored syntax. Bodies that already used that block turn into plain text when saved again, so do not remove blocks that are in use.
- A container that holds body content starts with an empty paragraph when inserted from the slash menu. `editor.insert.codeBlocks` (`[{ language, title?, code? }]`) starts it with those code blocks instead, `title` being the code fence's `title` meta (the code explorer uses it to start with one `src/index.ts` file).
- The admin package builds editor nodes from the definition. Change the editing look with the admin package's `blockViews` (the whole view of any block,
  built on `useBlockEditor` and `Content`), and supply previews of code fence blocks with `fencePreviews`.
- Code fence blocks on public pages are drawn from the document by `renderDocument`/`CmsContent` with the component registered for the block (`documentComponents` of a plugin's `render` module, or the site's `components`). Nothing has to be added to a render chain.
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

## Rendering a stored document

`renderDocument` (and the server component `CmsContent`) of `@monti-cms/core/render` draws the stored document (`StoredDocument`) with React: no MDX compile and no code execution
on the public path. Core renders documents only; text is drawn by reading it into a document first (`renderMdx` of `@monti-cms/mdx/render` does that for MDX).

```tsx
import { CmsContent, renderDocument, tableOfContents, type DocumentComponents } from "@monti-cms/core/render";

const entry = (await cms.read.getEntry({ collection: "post", slug, locale })).entry; // the document and its refs
// in a server component: the images and files come from entry.refs, the language from entry.locale
<CmsContent entry={entry} components={components} />;
tableOfContents(entry.doc); // the headings of levels 2 and 3, the same anchors, no React
// a document on its own:
const { content, toc, unknown } = await renderDocument(doc, { locale, refs, components });
<CmsContent doc={doc} refs={refs} locale={locale} components={components} />;
```

- **Two phases.** An async pre-pass reads the whole document once (heading anchors and the table of contents, footnote numbers, Shiki highlighting of every code block, KaTeX output
  of every formula), then a synchronous, pure render turns nodes into elements. The result is a plain React tree for server components and `renderToStaticMarkup` tests.
- **Never throws on content.** An unknown node, mark or block, a block without a component and a node with malformed attributes go through the `fallback` component and are
  listed in `unknown` (and passed to `onUnknown`). An unknown container shows its content, an unknown leaf nothing; in development the default fallback leaves a hidden
  `<span data-cms-unknown>`. `strict: true` throws instead (tests, the preview page). A value that is not a stored document renders an empty body and is logged.
- **Components** are layered: core defaults, then the block extensions' components (`documentComponents` of a plugin's `render` module: `CmsPlugin.render` returns `{ documentComponents }`, and the old MDX-shaped default export is gone), then the site's `components`. One props type per node
  (`ParagraphProps`, `HeadingProps` with its `id`, `ListProps`, `CodeBlockProps`, `ImageProps` with the resolved `src`, `FileProps`, `TableProps`/`TableRowProps`/`TableCellProps`, `MathProps`,
  `FootnoteRefProps`/`FootnotesProps`, `HardBreakProps`), one per core mark (`link`, `bold`, `italic`, ...), plus `codeTags` for the elements inside code blocks (`fold`, `collapse`, `Tooltip`).
  Every component also gets `ctx` (`locale` and the fixed `labels`; plain JSON, so it can cross to a client component), and a block component gets `blockId`, `node` and `items`.
- **Blocks are registered by block name with the attributes as flat props**, and the prop types come from the site config: `blocks: { callout: ({ variant, title, children }) => … }`,
  `marks: { tooltip: ({ content, children }) => … }`. The type of `components` (`DocumentComponents`) is built from the `blocks` of `cms.config.ts` and of its plugins
  (`defineBlock` keeps the attributes as literals, so `variant` is `"note" | "tip" | …`). A boolean attribute is always a boolean, a value with a default or a required string is always there,
  and a choice that is not one of the options is replaced by the default. A code fence block (`mermaid`, `chart`) gets the code as `source`.
- **One renderer.** Heading anchors follow `github-slugger`, footnotes number by first reference, the same Shiki pipeline draws code (line effects, text effects, line labels),
  and block formulas are KaTeX `htmlAndMathml`. A table is drawn by the table component (a scroll wrapper and `cms-table-*` classes), block KaTeX output sits in `<div class="cms-math">`, and an image goes through `refs`.

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
		formats: () => import("my-plugin/formats"), // a CmsFormat or a list of them ("Formats")
	});
```

- The server side (`server`) must not end up in the browser bundle, so give an empty entry point through the `browser` condition of the package `exports`.
- `formats` adds formats (notations the document can be written as and read from, "Formats"). It is read on the server when the instance first needs its formats.
- `validate` receives the collection, locale and block definitions and all plugins (`plugins`). Extensions that use roles check field kinds here.
- `contributes` is what you add to other plugins. The key and shape are decided by the receiving plugin, and the core does not read them. For example,
  `contributes: { ai: { actions: { … } } }` adds that feature if the AI plugin (`@monti-cms/ai`) is present and is unused otherwise.
  An extension can add features without knowing the receiving plugin (diagram creation in the blocks extension, search title suggestions in the SEO extension).
- The server-side `routes` receive addresses that are not in the core routes (`/api/cms/v1/*`). The core wraps them with the admin login check and the same-origin check, so
  forgetting authentication does not leave an open route. Only routes that must be reachable without login (external runners, webhooks) are taken out with `public: true` and verify on their own.
  `migrate` is called by `monti migrate` after the core tables.
- The same-origin check accepts the host of `Host` and `site.url`, and the first value of `X-Forwarded-Host` only when the host is trusted ("Host trust"). Behind a proxy that rewrites `Host`, set `site.url` or trust the host.
- The server-side `hooks` (`transform`, `validate`, `validatePublish`, `afterCommit`) are the same as the server config's, and run after the server config's hooks, in the order of the plugins. See "Hook contract".
- A plugin's route gets the instance that serves it, so plugin code reads its storage (`cms.storage("<plugin name>")`), stores (`cms.store()`, `cms.mediaStore()`) and its secrets (`cms.secrets("<plugin name>")`) from it, and keeps no global state for them. `adminRoute` and the other route scaffolding come from `@monti-cms/core/plugin/server`; `features(cms)` and `migrate(storage, cms)` receive the instance too.

### Plugin secrets

A plugin never receives the master secret (`secret` in the server config). The instance derives one key per plugin from it with HKDF-SHA256, using the info string `monti:plugin:<plugin name>:v1`, and hands the plugin an API that only works with that key:

```ts
const secrets = cms.secrets("my-plugin");   // inside a route, `features(cms)` or `migrate(storage, cms)`
secrets.available;                          // false when the server config has no `secret`
const stored = secrets.encrypt("sk-live-1234");   // "mk1:<key id>:<iv>:<tag>:<body>", AES-256-GCM, safe to keep in a text column
secrets.decrypt(stored);                    // "sk-live-1234", or null if it is not this plugin's value, from an unknown secret, or corrupted
secrets.isCurrent(stored);                  // false if it was made with a previous secret: decrypt it and encrypt it again
secrets.deriveKey("signing");               // a 32-byte key for another purpose (HMAC, hashing), different per plugin and purpose
```

- Two plugins get unrelated keys, so a plugin cannot decrypt another plugin's values, and a value read from one plugin's table says nothing about the master secret or another plugin's data. Plugin code still runs in your server process, so this separates what plugins store; it is not a sandbox.
- Each value carries the id of the key it was made with (the `mk1:<key id>` prefix), so `decrypt` picks the right secret without trying them all.
- Rotation: put the new value in `secret` and the old ones in `previousSecrets` (`previousSecrets: process.env.CMS_PREVIOUS_SECRET ? [process.env.CMS_PREVIOUS_SECRET] : []`). `decrypt` tries the current secret and then the previous ones, and `encrypt` always uses the current one. A plugin re-encrypts values with `isCurrent` false when it saves them again. Drop a secret from `previousSecrets` only after everything stored under it was re-encrypted (the AI plugin does this on `monti migrate`).
- A plugin that stored values in its own format before this API can declare it: `cms.secrets("my-plugin", { legacy: { prefix: "v1", domain: "my-key:" } })` makes `decrypt` also read `v1:<iv>:<tag>:<body>` values encrypted under `sha256("my-key:" + secret)`. The legacy format is read-only; `encrypt` never uses it.
- `cms.server` is the server config without `secret` and `previousSecrets`.

### Plugin storage

A plugin keeps its own data (settings, per-entry sync state, cached results) in the plugin storage of the instance, not in tables of its own and not through a database driver.
`cms.storage("<plugin name>")` returns a storage scoped to that plugin: documents (JSON) in named collections, keyed by string, each with a version.

```ts
const settings = cms.storage("my-plugin").collection<{ endpoint: string }>("settings");
await settings.get("default");                                                       // { key, value, version, createdAt, updatedAt } or null
const saved = await settings.set("default", { endpoint: "https://…" }, { expectedVersion: 0 });   // 0 creates
await settings.set("default", { endpoint: "https://…/v2" }, { expectedVersion: saved.version }); // replaces
await settings.list({ prefix: "team-" });                                            // in key order
await settings.delete("default", { expectedVersion: saved.version + 1 });
```

- A write names the version it expects. A different stored version fails with a `CmsError` coded `conflict` that carries the stored version (0 when there is no item), so two editors cannot overwrite each other unnoticed, and of two concurrent writers one wins. Deleting a missing item is `not_found`.
- Plugin and collection names are lowercase words (`ai`, `action-overrides`). Values are JSON: they are stored as JSON and come back parsed, so a `Date` becomes its ISO text and `undefined` is rejected (`invalid_input`).
- The migration hook is `CmsServerPlugin.migrate(storage, cms)`, called by `monti migrate` after the core tables. `storage.once(name, step)` runs `step` once (recorded in `cms_migrations` as `plugin:<plugin>:<name>`, also when called concurrently, and not at all if it throws) and returns whether it ran. `step` gets a `PluginMigration`: its collections inside the step's transaction, `importItem(collection, { key, value, version, createdAt, updatedAt })` (adds an item with the version and dates it had, never overwrites), and `readLegacyTable(table)` to read the rows of a table an earlier version of the plugin created itself (`null` when there is none; the table is only read). `once(name, step, { legacyNames })` also counts the step as done when an earlier version recorded one of those names.
- The Postgres adapter keeps the documents in the core table `plugin_documents` (created by the core migrations). A storage of another adapter behaves the same: `src/plugin/__test__/storage-contract.ts` is the contract, run against Postgres and against `createMemoryPluginStorage()` from `@monti-cms/core/testing`, which `fakeCms` uses by default (`fakeCms({ storage })` replaces it).
- The plugin API has no database driver types: `PluginDatabase`, `cms.database()` and `withTransaction` are gone, and neither `@monti-cms/core` nor `@monti-cms/core/plugin/server` exports anything from `pg`.

## Server config

| Item | Meaning |
|---|---|
| `database` | Content store. `postgres({ connectionString, schema })` |
| `media` | Store for images and attachments. `r2Storage` or `s3Storage` from `@monti-cms/core/s3` (`region`, `forcePathStyle`), or a connection implementing the `MediaStore` contract. Without it, media features are unavailable. |
| `auth` | Admin login, from `@monti-cms/nextjs/auth`: `githubAuth({ clientId, clientSecret, adminIds, devBypass, basePath?, secret })`. `basePath` is the login API path (default `/api/cms/auth`, see "Login path"), and `secret` is the value that signs login sessions (if unset, NextAuth reads `AUTH_SECRET`) |
| `trustHost` | Optional. Whether `Host` and `X-Forwarded-Host` can be trusted ("Host trust"). Default: the `AUTH_TRUST_HOST` environment variable, else off in production and on in development |
| `secret` | Master secret for values plugins keep encrypted in the DB (AI service keys). Plugins never see it: each gets a key derived from it and the plugin name ("Plugin secrets"). Keep it separate from the login signing value. |
| `previousSecrets` | Optional. Secrets `secret` replaced. Values encrypted with them stay readable and are encrypted again with `secret` when saved again, so changing `secret` does not make stored keys unreadable. |
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
- Each request must come from this machine: `Host` is `localhost`, `*.localhost`, `127.0.0.0/8` or `::1`, and `X-Forwarded-Host` and `X-Forwarded-For` (when present) are loopback too. Other requests have to sign in normally, and a warning is logged once. `cms.authGateway.isDevBypassActive()` applies the same check (async).

## Hook contract

Every content write goes through one pipeline in the core services: creating, saving, publishing (one entry or in bulk), duplicating, creating a translation, and a bulk change of metadata or folder.
Hooks are registered in the server config (`createCms({ server: defineServerConfig({ hooks }) })`) or in a plugin's server side (`CmsServerPlugin.hooks`), with the same shape.
The types (`WriteHooks`, `WriteHookContext`, `WriteData`, `ValidationHookContext`, `ValidationResult`, `WriteOperation`) are exported from `@monti-cms/core/server` and `@monti-cms/core/plugin/server`.

```ts
import { createCms, defineServerConfig } from "@monti-cms/core/server";

const server = defineServerConfig({
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

export const cms = createCms({ server });
```

| Stage | What runs |
|---|---|
| 1 | Build the input: from the request, or from the stored draft (publish, bulk) |
| 2 | `transform` hooks, in registration order (server config first, then the plugins in config order). Each gets the previous one's result |
| 3 | Core preparation: normalization, reference collection, core validation. **Always runs, on the transformed data** |
| 4 | `validate` hooks: extra failures and warnings |
| 5 | Publish (and restoring a record, which publishes it again): `validatePublish` hooks: extra failures and warnings |
| 6 | Store commit, one transaction per entry (a bulk change commits item by item) |
| 7 | `afterCommit` hooks |

- `operation` is `create`, `save`, `publish`, `duplicate`, `translate` or `restore`. A bulk metadata or folder change is a `save` per item, and a bulk publish is a `publish` per item.
  `entryId` is absent while the entry is being created. `metadata` and `doc` (the body as a stored document, one `unparsed` node for a draft whose body could not become a document) are copies: changing them does nothing unless a `transform` returns them.
  `validate` and `validatePublish` also get the prepared `snapshot` (a copy).
- Archiving, trashing, unarchiving and deleting do not change content, so they skip stages 2 to 5 and still fire `afterCommit`. Restoring a record publishes it again, so it runs stages 3 to 5 as a `restore` (`validate` and `validatePublish` run, so a restriction on publishing cannot be bypassed by trash and restore; `transform` does not, the content is unchanged). Restoring any other entry returns it to draft and runs nothing.
- Hooks run outside the database transaction and get no database client. They may be async. The internal store option `beforePublishCommit` (which does get the transaction's client) is not part of this contract and is unchanged.
- A `transform` that changes the draft while publishing has the change saved together with the publish, in one transaction (`afterCommit` then gets a `saved` change followed by a `published` one for the entry; a publish that changes nothing gets only `published`). A create or save that publishes at once (records) is reported the same way: `created` or `saved`, then `published`.
- A hook that throws, or returns something that is not its contract, fails the write with `hook_failed` (HTTP 500). The error names the hook and its owner (`server` or `plugin:<name>`) in `issues[].params`; nothing is stored. `validate` failures give `validation_failed` and `validatePublish` failures give `publish_validation_failed` (HTTP 422), with the added issues next to the draft's own.
- `afterCommit` gets ids, status and slugs only, never the body. Read the committed entry with `cms.store().getEntry(change.entryId)`. Delivery is in-process and at most once: it is not retried, and there is no outbox yet.

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
| `seed.templates` | Body templates inserted once, when the first migration creates a store: `{ id, name, doc }` (a stored document) or `{ id, name, body, format }` (a text and the format that reads it, "Formats"). |
| `codeBlock.lineEffects` | Add or override code block line effects ("Code block line effects"). |
| `codeBlock.omitLineEffects` / `features` / `themes` / `languages` | Hide line effects and tools in the editor, set the highlighting themes, and add languages ("Turning code block tools off, themes and languages"). |
| `media` | Media that can be uploaded. `maxImageBytes` (default 10MB), `maxPixels` (default 40 million), `maxFileBytes` (default 50MB) and the accepted formats `imageTypes` (among jpeg, png, webp, gif, avif) and `fileTypes` (among pdf, zip, txt, md, csv, json; an empty list accepts no attachments). The upload API, the admin file picker and `/v1/meta` follow it. |
| `admin.locale` | Admin UI language and date and number formatting (BCP 47, e.g. `en`, `ko-KR`). If unset, the site default language (`defaultLocale`). Times are shown in `timeZone`. |
| `admin.messages` | Override UI text: namespace → key → text. Core block labels are in `"cms.blocks"` (`<block>.label`, like `image.label`), code block effects in `"cms.code-block"`, and validation error texts in `"cms.core"` and `"cms.translation"` (the texts of reading MDX are in `"cms.mdx"`, from `@monti-cms/mdx`). |

### Collections

- **Kind (`kind`).** A `document` has a body, separates draft from published content, and is published explicitly. An `item` is a small form whose saved values
  are reflected in the public value immediately (no publishing, archiving or translations; per-language values go in `translations`). The body (`body`), if absent, is used only by documents.
  The old name `workflow: "publish" | "record"` was removed; a config that still has it fails with the `kind` to use (`publish` → `document`, `record` → `item`).
- **Layout (`layout`).** If absent, it is one group in field declaration order, and fields with their own `tab` gather in that tab.
- **List (`list.columns`).** If absent, the default columns. For documents: title, status, language (when there are two or more languages), category field (a relation
  pointing to an item collection), modified date and published date; for items: title, URL (when there is a URL field), language, status and modified date.

A collection's `path` (e.g. `/posts/:slug`) is the shape of the public URL. It is used to recognize internal links written as an address (they are stored as the id of the entry, see the public read API) and by the editor when it creates links. A collection without `path` cannot be linked to from the body.

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
  with the plain text at the start of the body (only for collections with a body, and never over the field's `max`). The core function is `bodyExcerpt(doc, maxLength)`. The text is taken from the stored document, so it does not depend on the notation the body was written in: prose, headings, list items, table cells, block bodies and the text attributes of blocks (a callout title); code, math and images are left out. Body search text is built the same way, and also keeps code, image alt text and captions.
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

- The only store is Postgres. The store is a port (`ContentStore` in `src/core/store/ports.ts`, split into sub-ports for entries, lifecycle, the list, folders, public reads, media metadata, templates, preferences and export), and the Postgres adapter (`src/adapters/postgres`) implements it. The rules a store applies (slug addresses, translations, publish and lifecycle transitions) are pure functions in `src/core/domain`. `src/core/store/__test__/contract` is the contract test suite a second adapter has to pass; the contract is still large.

## Development

```bash
pnpm --filter @monti-cms/core test:run
pnpm --filter @monti-cms/core typecheck
```

The package's own tests run with the sample site config `test/cms.config.ts`. A test that needs an instance builds one with `fakeCms` (or `createCms` over fake adapters); no test mocks a module for it.

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
