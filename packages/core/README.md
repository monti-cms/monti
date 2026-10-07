# @monti-cms/core

English | [한국어](README.ko.md)

The core of a DB (Postgres)-backed blog CMS. It handles the site config, collection schemas, content saving and publishing, the document model, the admin API and plugin wiring.
The admin UI is `@monti-cms/admin`, everything specific to Next.js is `@monti-cms/nextjs`, MDX (the `mdx` format, the source panel and the syntax extensions) is the plugin `@monti-cms/mdx`, and the AI features are the plugin `@monti-cms/ai`. `examples/blog` is an example with everything wired together.

## Supported frameworks

Next.js (App Router) is the only supported host for now. The code is layered so that this is a property of one package, not of the core or the admin:

- `@monti-cms/core` speaks the standard `Request` and `Response` (`cms.handle(request)`) and imports nothing from Next.js. What a host has to supply (the headers of the current request, a redirect after login) comes in through the login connection (`CmsAuth.requestHeaders` and `CmsAuth.rethrow`).
- `@monti-cms/admin` (the screens and `@monti-cms/admin/hooks`) imports nothing from Next.js either. It reaches the router only through an adapter it is given, `{ Link, navigate, replace, usePathname, useSearchParams }` (`AdminRouterProvider` of `@monti-cms/admin/router`), and the two things its server screens need, a redirect and a 404, through `AdminServer` (`@monti-cms/admin/host`).
- `@monti-cms/nextjs` holds all the Next glue: the route handler, `withCms` for `next.config.ts`, the admin page and layout with the App Router adapter, and `nextHost`, the Next side of the login.
- `@monti-cms/auth` is the admin login, and it is framework-neutral too: it implements `CmsAuth` on `Request` and `Response` over Auth.js core, with the ways to log in as pluggable providers (GitHub ships with it).

Another host (Astro, Remix, ...) would be a new adapter package, not a change to the core or the admin. Tests keep the boundary: no source file of the core or the admin may import `next/*`.

## Install in an empty Next app

This assumes a Next 16 (App Router) and React 19 app. The admin needs no Tailwind: its styles are prebuilt, so the app may use any CSS setup. Only Postgres is supported as the store. The order is `monti init` → edit the collections → `monti migrate`.

### 1. Packages

```sh
pnpm add @monti-cms/core @monti-cms/admin @monti-cms/auth @monti-cms/nextjs next-themes @tanstack/react-query sonner \
  @tiptap/core @tiptap/pm @tiptap/react lucide-react
```

The admin package and the AI plugin must share one copy of React Query, sonner, Tiptap and the lucide icons with the app, so the app installs them (peers).
Login is `@monti-cms/auth` (Auth.js core, no Next.js in it); GitHub login needs no extra package. See its README for providers.
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
| The schema file: the site's data (a one-collection starting point, English labels), with a `$schema` link for editors | `monti.schema.json` |
| Site config: loads the schema file and adds what needs code (plugins) | `cms.config.ts` |
| The types of the schema file, written from it (not edited by hand) | `monti-env.d.ts` |
| The CMS instance and its server config (DB, GitHub login; secrets come from environment variables) | `cms.server.ts` |
| Admin UI (the layout imports the prebuilt admin stylesheet) | `app/(admin)/admin/[[...path]]/page.tsx`, `layout.tsx` |
| Admin API and login (`/api/cms/v1/*`, `/api/cms/auth/*`) | `app/api/cms/[...path]/route.ts` |
| Config wiring (`withCms`) | `next.config.ts` (when it has the default shape with a single `export default nextConfig;` line); created if missing |

For apps that use `src/app`, the config files go in `src/` and the routes under `src/app/`. Files that cannot be edited safely (a next config that does not have the default shape) are left as they are, and what to add is shown as a "to do".
At the end it lists the packages to install, the environment variables and the GitHub callback URL.

With `--admin-path`, the route folder becomes that path (`app/(admin)/studio/…`) and `admin: { path: "/studio" }` is added to the schema file.
**The admin path must be the same in `admin.path` (the schema file, or the site config) and in the route folder.** When you change it later, change both together.
The admin API path (`/api/cms/v1`) does not change.

`--locale <code>` is the site's default language (`defaultLocale`) and defaults to `en` (a lowercase language code such as `ko`). The admin UI's language and
date and number formatting follow it, and can be chosen separately with `admin.locale` in the config. `--time-zone <zone>` is the time zone in which dates and times are entered and
shown (an IANA name, default `UTC`). The generated config files and the command-line help and output are read by developers, so they are in English.

An app that already has a `cms.config.ts` keeps it: `monti init` creates no schema file next to a config it did not write, and tells you to run `monti schema:extract` ("The schema file"). `cms.config.ts` imports the JSON, so `tsconfig.json` needs `"resolveJsonModule": true` (`create-next-app` sets it; `monti init` says so when it is missing).

### 3. Edit the collections

The site's data lives in `monti.schema.json`; `cms.config.ts` loads it and adds what needs code ("The schema file"). `cms.server.ts` imports the config and hands it to `createCms`, and the admin UI gets it from that instance as data, so do not put secrets in either. The generated starting point is this.

```json
{
	"$schema": "./node_modules/@monti-cms/core/schema.json",
	"collections": {
		"post": {
			"label": "Post",
			"kind": "document",
			"path": "/posts/:slug",
			"icon": "file-text",
			"fields": {
				"title": { "kind": "text", "label": "Title", "required": true, "max": 200 },
				"slug": { "kind": "slug", "label": "Slug", "from": "title", "required": true },
				"summary": { "kind": "text", "label": "Summary", "role": "summary", "multiline": true, "fillFromBody": true }
			}
		}
	},
	"locales": [{ "code": "en", "name": "English" }],
	"defaultLocale": "en",
	"timeZone": "UTC",
	"site": { "name": "My site" }
}
```

```ts
// cms.config.ts
import { defineConfig } from "@monti-cms/core";
import schema from "./monti.schema.json";

export default defineConfig({
	schema,
	// plugins: [...blocks(), seo()],
});
```

The collection name (`post`) is stored in the DB, so do not change it in production. `kind` is `document` (a body, drafts and publishing) or `item` (a small entry such as a tag); `path` is the public URL, used for internal links in the body and for preview URLs; the title field is named `title`.
Without `layout` and `list`, fields are drawn in field order with the default list columns ("Collections"). Run `pnpm exec monti schema:types` (or keep `next dev` running, which does it for you) after editing the file. See "The schema file" and "Config" below for the rules.

`cms.server.ts` creates the CMS instance (`createCms({ config, server })`, see "The CMS instance"). Its server config holds the store, media and login connections and the secrets, and is only read on the server.
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
| `AUTH_SECRET` | A random long value. Signs login sessions (`auth({ secret })`) |
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
- File: the server file, the module that exports the instance as `cms`, is `--server` → `CMS_SERVER_PATH` → `./cms.server.ts`/`./src/cms.server.ts`. It imports the site config itself, so there is no config option.
- In a script of your own, import the instance and call it: `import { cms } from "./cms.server"; await cms.migrate(); await cms.close();`
  (run it with `tsx --env-file=.env.local script.ts`; the instance holds the site config, so nothing else has to be linked).

### 5. Run

Start it with `next dev` and open the admin path (default `/admin`).

### Login path

By default the login API is served by the admin API route as well (`/api/cms/auth/*`), so there is no separate login route file.
Apps that still use `/api/auth/*` as before (apps that do not want to change an already registered OAuth callback URL) pick the path and add a route file.

```ts
// cms.server.ts
auth: auth({ providers: [/* … */], host: nextHost, basePath: "/api/auth" }),

// app/api/auth/[...auth]/route.ts
import { cms } from "../../../../cms.server";
export const { GET, POST } = cms.authHandlers;
```

If `basePath` is not the default, the admin API route does not serve `/api/cms/auth/*` (404).

### Optional dependencies

Optional dependencies of the CMS packages (e.g. `mermaid` and `recharts` of the blocks extension) are installed only when you use that feature. For anything not installed, `withCms` (of `@monti-cms/nextjs/config`)
links an empty module (`@monti-cms/core/stubs/missing-optional`) so the build does not stop, and using that feature raises an error telling you to install it.
After installing, restart the dev server.

### Manual wiring (without `monti init`)

To do by hand what `monti init` does: create the site config and the server file (the instance, `createCms({ config, server })`), wrap `next.config.ts` in
`withCms(nextConfig)` (`import { withCms } from "@monti-cms/nextjs/config"`; there is no alias or `tsconfig.json` `paths` entry to add, and none for tests (Vitest) either),
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
import "@monti-cms/blocks/styles.css"; // in the admin layout, after "@monti-cms/admin/styles.css" (callout look and block variables; the public page styles are `@monti-cms/blocks/render.css`)
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

## The CMS instance

`createCms({ config, server })` (from `@monti-cms/core/server`) turns the site config and the server config into the instance everything on the server uses. The instance owns the site (the resolved
site config, `cms.site`), the content store, services, media store, login connection, plugin server modules, write hooks and the secret. Nothing is global: two instances with different configs and server configs live
side by side in one process (tests, scripts, several sites and databases).
Connections are created on first use, so creating the instance at import or build time connects to nothing.

```ts
// cms.server.ts
import { createCms, defineServerConfig, postgres } from "@monti-cms/core/server";
import { auth } from "@monti-cms/auth";
import { github } from "@monti-cms/auth/github";
import { nextHost } from "@monti-cms/nextjs/auth";
import config from "./cms.config";

export const cms = createCms({
	config,
	server: defineServerConfig({
		database: postgres({ /* … */ }),
		auth: auth({ providers: [github({ /* … */ })], host: nextHost }),
	}),
});
```

Everything else imports `cms` from this file.

| Where | Code |
| --- | --- |
| Admin API route (`app/api/cms/[...path]/route.ts`) | `export const { GET, POST, PATCH, PUT, DELETE } = createRouteHandler(cms);` (`createRouteHandler` of `@monti-cms/nextjs`, the Next adapter of `cms.handle(request)`) |
| Admin API in another host | `cms.handle(request)`: a standard `Request` in, a `Response` out |
| Admin layout and page | `<CmsAdminLayout cms={cms}>…</CmsAdminLayout>`, `<CmsAdminPage cms={cms} {...props} />`, and `export const generateMetadata = () => cmsAdminMetadata(cms);` in the layout file (from `@monti-cms/nextjs/admin`) |
| Site pages (server components, sitemap, RSS) | `cms.read.getEntry(…)`, `cms.read.listEntries(…)`, `cms.read.getTranslations(…)`, `cms.read.getPreview(…)` (pass a `format`, for example `"mdx"` with `@monti-cms/mdx`, to also get the body as text in `entry.body`, "Formats") |
| Public media and links | `entry.refs` (the URLs of the media and the addresses of the internal links of `entry.doc`, drawn by `<CmsContent cms={cms} entry={entry} />`), `cms.read.mediaUrl(mediaId)` |
| Stores and settings | `cms.store()`, `cms.contentService()`, `cms.bulkService()`, `cms.mediaStore()`, `cms.storage(pluginName)`, `cms.secrets(pluginName)`, `cms.auth()`, `cms.authGateway`, `cms.authHandlers`, `cms.isMediaConfigured` |
| Scripts and the command line | `cms.migrate()`, `cms.close()` |
| Plugin routes | `adminRoute(async ({ request, params, auth, cms }) => …)`: the route gets the instance that serves it |
| The site | `cms.site`: collections and their rules, locales, URLs, blocks, code block settings, admin addresses and language ("The site config belongs to the instance") |
| Tests | `fakeCms({ config, store, verifyAdmin, … })` from `@monti-cms/core/testing`: a real instance over the parts the test provides (a minimal English site if it passes no `config`) |

**HTTP layer.** The admin API, the login connection, the public API and the plugin routes work on the standard web `Request` and `Response`; no `NextRequest`, `NextResponse` or `request.nextUrl` is used.
`cms.handle(request)` serves one request (the path after `/api/cms/` is read from the URL), and `createRouteHandler(cms)` of `@monti-cms/nextjs` is the thin Next adapter built on it.
Plugin routes (`adminRoute`) receive a standard `Request`: read the query with `new URL(request.url).searchParams` and answer with `Response.json(…)`.
The core imports nothing from Next.js. What a host supplies reaches it through the login connection: `CmsAuth.requestHeaders()` (the headers of the request being handled, which the development login bypass and `session()` read) and `CmsAuth.rethrow(error)` (lets a redirect that a login library throws pass through to the host; `@monti-cms/auth` answers with a `Response` and does not need it). `nextHost` of `@monti-cms/nextjs/auth` provides `requestHeaders` with Next's own function, and is passed to `auth({ host })`; a host for another framework provides its own.

The reading API hangs off the instance (`cms.read.getEntry(…)`, not `getEntry(cms, …)`): site code imports one thing, and its types (`MetadataFor` and so on) stay in `@monti-cms/core/read`.

**Development reload.** `next dev` evaluates `cms.server.ts` again after an edit, which calls `createCms` again, and a new database adapter would open a second connection pool without closing the first.
So, in development only (`NODE_ENV=development`), an instance reuses the database adapter (and the media store) of the first instance created with the same `id` (default `"default"`),
kept under one `Symbol.for("monti.cms.dev-connections")` entry on `globalThis`. Everything else (store, services, login connection, plugins, hooks, secret) is rebuilt from the new server config, so edits to hooks and options take effect.
Changing the database connection itself needs a restart. In production and in tests there is no such cache: an instance owns its connections alone. If one development process creates more than one instance, give each its own `id`: `createCms({ id: "reports", server })`.

### The site config belongs to the instance

`createCms({ config })` takes the site config as a value and holds it. There is no config alias and no module-level constant derived from the config, so nothing assumes the config is known when a module is imported, and one process can hold
several sites. `createSite(config)` (`@monti-cms/core/client`) resolves a config into a `Site`: `LOCALES`, `DEFAULT_LOCALE`, `COLLECTIONS`, `schemaOf(name)`, `storedFields(name)`, `contentPath(…)`, `parseInternalLink(…)`, `adminHref(…)`, `BLOCKS`,
`CODE_LINE_EFFECTS`, `getPluginOptions(name)`, `createTranslator(messages)` and the rest of what used to be exported as constants and functions that read the config. The instance carries its `Site` as `cms.site`
(`cms.site.config` is the config object itself), and everything that needed the config receives it from the instance:

| Part | Gets the site from |
| --- | --- |
| Store, services, read API, HTTP handler, plugins, the login connection, `monti migrate` | the instance: `createCms` passes `cms.site` on (`createStore({ site })`, `createContentService(store, { site })`, `createRead({ site })`, `AuthCreateContext.site`, ...) |
| Admin UI | `<CmsAdminLayout cms={cms}>` renders `<SiteProvider config={cms.site.snapshot()}>` around the screens, and client components read it with `useSite()` and `useTranslator(messages)` (`@monti-cms/core/client`). The browser never loads a config file |
| Public renderer | `<CmsContent cms={cms} entry={entry} />` and `renderDocument(doc, { site: cms.site })`: the site decides which blocks, marks and code fences exist, the line effects and the highlighting themes, and which plugin components are added |
| Code of your own | `cms.site` on the server, `useSite()` in client components. A helper that needs a site takes it as a parameter |

**What reaches the browser.** `site.snapshot()` is the config as plain data: the collections, locales, `site`, `admin`, `timeZone`, `media` and `codeBlock` settings, every block (the blocks of plugins included) and, for each plugin, `name`, `nav`, `options` and `contributes` as JSON. A function inside a plugin's `options`
or `contributes`, a text override of `admin.messages` that is a function (strings stay), and a plugin's `server`, `admin`, `render`, `formats` and `validate` do not reach it: the admin layout loads the plugins' admin modules on the server and renders their providers itself. Keep what the browser needs from `options` to JSON values.

**Typing.** The types follow the config you pass, with no registration step. `createCms({ config })` returns `Cms<typeof config>`, so `cms.read.listEntries({ collection: "post" })` knows the collection names and the metadata of each (`MetadataFor<"post", typeof config>`, `CollectionName<typeof config>`),
and a collection that is not in the config is a type error. Where a library type cannot see an instance, give it the config type: `DocumentComponentsFor<typeof config>` or `DocumentComponentsOf<typeof cms>` types the `components` of `<CmsContent>` (block names and the attribute props of each block), and the AI plugin's action names take the config type the same way.
A plain `Cms` or `Site` is an instance of any config, with `string` names. Two instances with different configs are typed independently. A site that keeps its data in a schema file gets the same types from the declaration file `monti schema:types` writes ("The schema file").

### Upgrading from the `@cms-config` alias

- `cms.server.ts`: `import config from "./cms.config"` and `createCms({ config, server: … })`.
- Remove `"@cms-config"` from `tsconfig.json` `paths` and from Vitest `resolve.alias`; `withCms(nextConfig)` takes no options. `monti migrate` has no `--config` option and ignores `CMS_CONFIG_PATH`; it loads the server file, which imports the config. `@monti-cms/core/register` is gone: run scripts with plain `tsx`.
- Admin layout: `export const generateMetadata = () => cmsAdminMetadata(cms);` instead of `export { cmsAdminMetadata as metadata } from "@monti-cms/nextjs/admin"` (the title follows the site name and admin language of the instance).
- Rendering: `<CmsContent cms={cms} entry={entry} />` and `renderDocument(doc, { site: cms.site, … })`; `renderMdx(doc, { site })` the same way. Type the `components` table with `DocumentComponentsOf<typeof cms>` (or `DocumentComponentsFor<typeof config>`) instead of the old `DocumentComponents`, which is now the untyped table.
- Config-derived values and helpers that were exported by `@monti-cms/core/client` (`LOCALES`, `DEFAULT_LOCALE`, `isLocale`, `localizePath`, `COLLECTIONS`, `schemaOf`, `contentPath`, `parseInternalLink`, `adminHref`, `SITE_NAME`, `BLOCKS`, `CODE_LINE_EFFECTS`, `getPluginOptions`, ...) are members of the site: `cms.site.LOCALES` on the server, `useSite().LOCALES` in client components.
  `createTranslator(messages)` at module level becomes `site.createTranslator(messages)` or, in a component, `useTranslator(messages)`. `formatDateTimeInput` and `parseDateTimeInput` need a time zone (or use the site's: `site.formatDateTimeInput(value)`).
- Plugins and adapters: `CmsServerPlugin` and routes are unchanged (`cms.site` is on the instance they get). A `DatabaseAdapter` receives the site (`createStore({ site })`, `migrate({ site, formats })`), and an `AuthAdapter` gets it in `create({ site, loginPath, trustHost })`.
  Text that block and line-effect definitions pick with `createActiveTranslator` is read once when the site is created, in the admin language of that site. Anything else that translates at run time uses `site.createTranslator`.
- Tests: no test needs to mock a config module. Create the site or the instance the test needs (`createSite(config)`, `fakeCms({ config })`, `createCms({ config, server })`), and wrap React trees in `<SiteProvider site={site}>`.

### Upgrading to `@monti-cms/nextjs`

All Next-specific code moved out of `@monti-cms/core` and `@monti-cms/admin` into the new package `@monti-cms/nextjs`. There are no aliases left at the old places.

- Install `@monti-cms/nextjs` (`next` is its peer; core and admin no longer ask for it).
- `next.config.ts`: `import { withCms } from "@monti-cms/core/next"` becomes `from "@monti-cms/nextjs/config"`.
- `cms.server.ts`: `githubAuth` moves from `@monti-cms/core/server` to `@monti-cms/nextjs/auth` (and is replaced by `@monti-cms/auth`; see "Upgrading to `@monti-cms/auth`").
- `app/api/cms/[...path]/route.ts`: `cms.routeHandler()` becomes `createRouteHandler(cms)` from `@monti-cms/nextjs`. The `CmsRouteHandler` type is exported from there too.
- Admin layout and page: `@monti-cms/admin/next` becomes `@monti-cms/nextjs/admin` (`CmsAdminLayout`, `CmsAdminPage`, `CmsAdminPageProps`, `cmsAdminMetadata`; same props). The layout renders the App Router adapter for the admin.
- Admin messages: the page title keys moved from the `cms-admin.next` dictionary to `cms-admin.layout` (only matters if you override `admin.messages["cms-admin.next"]`).
- Your own `AuthAdapter`: `CmsAuth` has two optional members, `requestHeaders()` and `rethrow(error)`. Without `requestHeaders`, the development login bypass never applies.
- Mounting the admin screens some other way than `CmsAdminLayout`: wrap them in `NextAdminRouter` (`@monti-cms/nextjs/admin`), or in `AdminRouterProvider` with your own adapter.

### Upgrading to `@monti-cms/auth`

GitHub login moved from NextAuth (`next-auth`, inside `@monti-cms/nextjs`) to the framework-neutral package `@monti-cms/auth`, which is built on Auth.js core and takes the ways to log in as providers.

- Install `@monti-cms/auth`. `githubAuth` of `@monti-cms/nextjs/auth` keeps working with the same options (it calls the new package), so an existing `cms.server.ts` runs unchanged; it is deprecated.
- The new shape: `auth: auth({ providers: [github({ clientId, clientSecret, admins: [id] })], host: nextHost, devBypass, secret })`, with `auth` from `@monti-cms/auth`, `github` from `@monti-cms/auth/github` and `nextHost` from `@monti-cms/nextjs/auth`. `adminIds` becomes `admins` on the provider and still takes numeric GitHub ids (logins were never matched).
- Everyone signs in once more: sessions made by NextAuth are not read. Environment variables (`AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`, `AUTH_SECRET`, `AUTH_URL`, `AUTH_TRUST_HOST`) and the OAuth callback URL (`/api/cms/auth/callback/github`) are unchanged. `next-auth` can be removed from `package.json`.
- Account ids are qualified with the provider (`github:12345678`): `AuthContext.accountId`, `CmsAuth.devUserId`, and the author recorded for a change when the login gives no name. `isAdmin(userId)` of your own `CmsAuth` receives that value.
- `CmsAuth` changes (for your own `AuthAdapter`): `session(request?)` may be given the request, `signIn` and `signOut` may resolve with a `Response` that the route returns as it is (a redirect that carries cookies), `AuthProvider` has an optional `icon`, and `AuthCreateContext` has `storage(plugin)` (`cms.storage`).
- The `next-auth` module augmentation (`session.user.githubId`) is gone with NextAuth.

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
3. Nothing to import for its admin styles: `@monti-cms/admin/styles.css` already covers the MDX source panel.
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

`monti add <name...>` copies ready-made components from the Monti registry into your app as source you own: a public `article-body` (the stored document and a table of contents), a `blog-theme` (a paged post list and a post page for a collection, with the `article-body` it needs),
an admin `entry-editor` screen built on `useEntryEditor` and `useField`, a block edit view for `blockViews`. Imports are rewritten to your alias (`components.json` or `@/components`), the npm packages they
need are installed with your package manager, and a file you changed is never overwritten unless you pass `--overwrite`.

```sh
pnpm exec monti add article-body              # -> components/monti/article-body/article-body.tsx
pnpm exec monti add entry-editor --dry-run    # show the plan, change nothing
pnpm exec monti add article-body --registry ./registry/r   # another registry (folder or URL)
```

The registry follows the shadcn registry schema and lives in `registry/` of the repository (built into `registry/r`, committed). The components use the host's Tailwind and only public entry points
(`@monti-cms/admin/hooks`, `@monti-cms/core/render`, `@monti-cms/core/client`, `@monti-cms/core/read`, `@monti-cms/nextjs`). `examples/blog` installs `blog-theme` this way and uses it for its blog list and article pages.
Full reference, the list of components and how to add one: [`registry/README.md`](../../registry/README.md).

## Entry points

| Entry point | Used in | Contents |
| --- | --- | --- |
| `@monti-cms/core` | `cms.config.ts` | `defineConfig` (with `schema`)·`defineCollection`·`fields`·`defineBlock`·`definePlugin`, `parseSchemaFile`, the `SchemaFile` types |
| `@monti-cms/core/schema.json` | editors, `$schema` | The JSON Schema of `monti.schema.json` ("The schema file") |
| `@monti-cms/core/schema-types` | dev tooling (`withCms`) | `generateSchemaTypes`, `watchSchemaTypes`: write `monti-env.d.ts` from the schema file |
| `@monti-cms/core/schema-change` | settings screen, command line | `diffSchema`, `checkSchemaChange`, `suggestTransforms`, `planSchemaChange`, `applySchemaChange` ("Changing the schema") |
| `@monti-cms/core/schema-edit` | settings screen (server side) | `schemaEditAccess` (who may write the schema file), `readSchemaScreen`, `previewSchemaEdit`, `saveSchemaEdit`, `formatSchemaText` ("Editing the schema in the admin") |
| `@monti-cms/core/server` | `cms.server.ts` | `createCms`, `defineServerConfig`, `postgres`, store contract types (`MediaStore`, etc.). Store modules are loaded on first use |
| `@monti-cms/core/s3` | `cms.server.ts` | `r2Storage`, `s3Storage` (S3 API media stores; the AWS SDK is an optional dependency) |
| `@monti-cms/nextjs` | `app/api/cms/[...path]/route.ts` | `createRouteHandler(cms)` |
| `@monti-cms/nextjs/config` | `next.config.ts` | `withCms` |
| `@monti-cms/nextjs/admin` | admin route files | `CmsAdminLayout`, `CmsAdminPage`, `cmsAdminMetadata(cms)`, `NextAdminRouter` |
| `@monti-cms/nextjs/auth` | `cms.server.ts` | `nextHost` (pass as `host` to `auth()`), `githubAuth` (deprecated) |
| `@monti-cms/auth` | `cms.server.ts` | `auth({ providers, admins?, secret?, devBypass?, basePath?, host? })`, the `LoginProvider` type |
| `@monti-cms/auth/github` | `cms.server.ts` | `github({ clientId, clientSecret, admins })` |
| `@monti-cms/core/render` | public pages (server components) | `CmsContent` (`<CmsContent cms={cms} entry={entry} />`), `renderDocument(doc, { site, … })` → `{ content, toc, unknown }`, `DocumentComponentsFor<typeof config>` and `DocumentComponentsOf<typeof cms>`, `tableOfContents(doc)`, the component prop types ("Rendering a stored document"). MDX text is drawn by `renderMdx` of `@monti-cms/mdx/render`. In the site CSS: `@import "@monti-cms/core/render.css";` |
| `@monti-cms/core/read` | public pages (types) | `ReadEntry`, `MetadataFor` and the other types of `cms.read`, which reads published content (`getEntry`, `listEntries`, `getTranslations`, `getPreview`: relations, URLs, old-URL redirects, source fallback) |
| `@monti-cms/core/runtime` | server code (including cron scripts and site tests) | store and service types, login types, snapshot helpers. It does not use `server-only`, so it can be loaded outside Next (plain `tsx`) |
| `@monti-cms/core/client` | UI code | `createSite`, `Site`, `SiteProvider`, `useSite`, `useTranslator`, API shapes and the pure collection, locale, URL, block and schema helpers (the ones that depend on a config are members of the `Site`) |
| `@monti-cms/core/code-block` | public renderer, editor | The code block annotation model |
| `@monti-cms/core/document` | screens and plugins that edit or inspect a body | The `StoredDocument` type and the helpers that work on a document without knowing its notation: block ids (`assignBlockIds`, `isBlockId`, `withoutBlockIds`), `canonicalDocument`, `readStoredDocument`, `emptyStoredDocument`, `unparsedDocument`, link, image and table helpers, the stored code block model. Nothing in it parses or writes a text notation. The admin editor and AI import from here |
| `@monti-cms/core/format` | plugins that add a format | `defineFormat`, the `CmsFormat` interface with its context and issue types, `createFormatRegistry` ("Formats"). It does not read the site config, so a plugin may import it anywhere |
| `@monti-cms/core/notation` | format and syntax extension packages | A light entry with the helpers a notation builds on: the code comment syntax (`resolveCommentSyntax`, `formatAnnotationComment`) and the table helpers. `@monti-cms/mdx` re-exports them for syntax extensions |
| `@monti-cms/core/plugin/server` | server side of plugins | route scaffolding (`adminRoute` hands the route the `cms` instance), the `Cms` type, errors |
| `monti` (command line, package `bin`) | terminal | `monti init` (create files), `monti add` (install components as source), `monti migrate` (create tables), `monti events:retry` (deliver `afterCommit` events that are due), `monti <plugin>:<command>` (a command a plugin adds, "Plugins"), `monti schema:types` (types of the schema file), `monti schema:extract` (move a TypeScript config to the schema file), `monti schema:diff` and `monti schema:apply` (check and apply a schema change) |
| `@monti-cms/core/cli` | command-line tooling | `runCli`, `initProject`, `addComponents`, `migrate`, `generateSchemaTypes`, `extractSchema`, `schemaDiff`, `schemaApply` (the code behind the `monti` command) |
| `@monti-cms/core/testing` | tests | `fakeCms` (an instance over the parts a test provides), isolated-schema DB, sample data. Helpers that need MDX text are in `@monti-cms/mdx/testing` |

## Building the packages

Inside the repository the sources (`src`) are used directly. For the distributable bundle, `pnpm build:packages` produces `dist` and `pnpm pack` packages it using
`publishConfig.exports` (dist). `pnpm example:pack` puts the bundle into `examples/blog/vendor`.

## Body syntax

Core stores a body as a document and does not read or write any text notation. A notation is a **format** ("Formats"), and MDX is the format of the package [`@monti-cms/mdx`](../mdx): what is written by default (line breaks, tables, images, blocks as JSX), the *syntax extensions* that add a notation
(`@monti-cms/syntax-directive` for `:::callout`, `@monti-cms/syntax-shiki` for Shiki code notation), and how to write one are described in its README. Syntax extensions are listed in `mdx({ syntax })` in `plugins`, not in a config key of core.

#### Stored bodies

Every body (the working and published bodies of entries, the source a translation was confirmed against, and body templates) is stored as a versioned **document** (`entry_bodies.doc`, `body_templates.doc`: the parsed body as JSON). The document is the only source: nothing writes text next to it. The `mdx` columns of `entry_bodies` and `body_templates` are optional (`0020_mdx_columns_optional`) and are never written; they are not dropped, so old rows keep their text.
Saving a body in another spelling of the content it already has changes nothing (no new version). A text typed in a source panel (the `mdx()` plugin provides one) is read in the browser into a document, and the document is what is saved.
A body that cannot become a document (its text does not parse, has front matter, or would not read back the same) is stored as an **`unparsed`** document: one node `{ "type": "unparsed", "attrs": { "format": "mdx", "source": "<the text as given>" } }`, which keeps the text exactly. A draft can hold it, the editor shows it as source, and publishing it is blocked by the issue `unparsed_body`. The reasons it was rejected (`mdx_error` with the line and column in the text, `frontmatter_present`) are reported next to it.

**What is checked.** Core checks, hashes and searches the stored document, never a text, so a body is treated the same however it was written or sent. Those are `prepareSnapshot` and `validateForPublish` (required, unknown and invalid block attributes, references, internal links, image sources, footnotes, code-line links, table merges, translation notes left in the text), the content hash (`computeContentHash(metadata, doc)`, the same value as before: the document without block ids, keys sorted; the schema version an entry is stored under is not part of it, see "Changing the schema")
, the search text and excerpts (`documentText(doc, options)`, `bodyExcerpt(doc, maxLength)`) and the translation helpers (`withTranslationHints`, `compareStructure`, `diffSources` take documents). A body given as text is read into a document by its format first, and a document is taken as given (its text runs and trailing blank paragraphs are put in their canonical form).
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

- **Entry search for pickers.** `GET /api/cms/v1/entries/search?collection=…&query=…&locale=…&publishedOnly=true&limit=20` finds entries of one collection by title for a picker (the relation field of the admin searches this way instead of loading the whole list). It answers `{ items: [{ id, title, slug, status }] }`, best title matches first (an equal title, then a title that starts with the query, a word that starts with it, a title that contains it, a slug that contains it), at most `limit` (default 20, at most 50), never the trash. Repeating `id` looks those entries up by id instead. The store port is `searchEntries` (`ListStore`).
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
- A block can check its own syntax with `validate(node, ctx)`. Core calls it for every node of the block (a code fence of its language, an element, or a text decoration) in the write pipeline, after core preparation, on every create, save, publish and bulk, API or AI write.
  `node` has `name`, `id` (the block's id in the stored document), `attributes` and, for a fence block, `source` (the code without its annotation comments); `ctx` has `site` (`site.createTranslator(messages)` gives text in the admin language), `locale` and `operation`.
  It returns `{ code, message?, params? }[]` (or a promise of one). The findings are **warnings**, never blockers: each carries the block's id in `position.blockId` and its name in `params.block`, comes back as `warnings` in the save and publish responses, and the editor shows it under that block. A check that throws becomes a `block_validate_failed` warning and the write goes on.
  `validate` is a function, so it runs on the server and is not part of the block data the browser receives.
  `@monti-cms/blocks` checks a chart with its own parser (`parseChartDsl`) and a Mermaid diagram with `mermaid.parse` (only when `mermaid` is installed).

```ts
defineBlock({
	name: "map",
	label: "Map",
	syntax: { kind: "fence", lang: "map" },
	component: "Map",
	attributes: {},
	editor: { view: "node", insertable: true },
	validate: (node) =>
		(node.source ?? "")
			.split("\n")
			.flatMap((line, index) =>
				/^-?\d+(\.\d+)?,\s*-?\d+(\.\d+)?$/.test(line.trim())
					? []
					: [{ code: "map_line", message: `Line ${index + 1} is not "lat,lng".`, params: { line: index + 1 } }],
			),
});
```

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

### Allowed blocks and marks per body

A body can limit the blocks and marks a writer may add. Write the object form of `body` on the collection, in `monti.schema.json` or in code with `defineCollection`:

```json
"memo": {
	"label": "Memo",
	"kind": "document",
	"body": {
		"blocks": ["callout", "collapsible", "table", "codeBlock", "image"],
		"marks": ["bold", "italic", "link", "tooltip"],
		"headings": [2, 3]
	},
	"fields": { "title": { "kind": "text", "label": "Title", "required": true } }
}
```

The object form means the collection has a body. Every key is optional, and a key that is left out allows everything of its kind (a body with no list allows all, as before). One list is read by the editor and by validation, so the two cannot disagree.

- `blocks`: core blocks by name, `table`, `taskList`, `math`, `image`, `file`, `codeBlock`, `blockquote`, `horizontalRule`, `footnotes` (the reference and the definition) and `text-align`; and the blocks added by block extensions or the config's `blocks` by block name (`callout`, `tabs`, `chart`, ...).
  The children of a block (a tab, a column, a table row or cell) go with their parent. Paragraphs, lists and line breaks are always allowed.
- `marks`: `bold`, `italic`, `strike`, `underline`, `code`, `link`, `superscript`, `subscript`, and the text styles added by block extensions or the config by block name (`tooltip`, `color`, `code-ref`, ...). The translation note is never limited.
- `headings`: the levels (1 to 6) a body allows. The editor offers levels 2 to 4 (the page title is the level 1 heading), so other levels are only checked in stored content.
- A name that is not a block or mark of the site (a typo, a block that is not installed) is an error when the config loads, so a mistake never leaves a block allowed by accident.

**What the editor offers.** `CmsEditor` takes the list (`allowed`; the edit screen passes the collection's) and offers only what it allows: the toolbar (the heading levels, text styles, script, alignment, lists, quote, code block, table, divider, footnote, link and upload tools), the `/` slash menu, the component menu, and the text bubble. Input rules (`> `, `# `, `- [ ] `, `---`, a code fence, `**bold**`) and shortcuts of what is not allowed are turned off, and a command that would add one is refused.
A block added from a block view (`useBlockEditor().addChild`) follows the same list: adding a code block to a container while code blocks are not allowed fails with `invalid_state`.

**Paste.** A pasted block that is not allowed is not inserted, but its text is: a text block (a heading of another level, a code block) becomes a paragraph, a container (a table, a quote, a callout) gives the paragraphs inside it, and a block with no text is dropped (a formula says its source, an image its description, a file its name). A mark that is not allowed is dropped from the text. The content is kept, only its form changes. Moving blocks inside the editor is not a paste and keeps them as they are.

**Content that is already there.** The list only limits what a writer can add. A body that holds a block or mark that is no longer allowed opens, shows it, and saves it unchanged: nothing is stripped, and the writer can edit inside it, move it, duplicate it and delete it (the same rule as turning code block tools off). Nothing is refused or stripped by the server either.

**Validation.**

- Stored content that the list does not allow is a **warning on every save and on publish**, never a blocker: `disallowed_block` (the block name, `heading 4` for a heading level) and `disallowed_mark`, each with the id of the block it is in (`position.blockId`).
- A write is **never rejected** for content the list does not allow, so the writer's other edits are always saved. Every save (the admin, the REST API, AI, bulk changes, a template) returns the same warnings, and the admin shows them like other save warnings. The editor (menus, input rules, paste conversion) is what keeps new content inside the list.

### Text color list

Text colors come from the blocks extension (`color({ palette })` of `@monti-cms/blocks`). The old config `textColors` is gone (move it to the option).

## Rendering a stored document

`renderDocument` (and the server component `CmsContent`) of `@monti-cms/core/render` draws the stored document (`StoredDocument`) with React: no MDX compile and no code execution
on the public path. Core renders documents only; text is drawn by reading it into a document first (`renderMdx` of `@monti-cms/mdx/render` does that for MDX).

```tsx
import { CmsContent, type DocumentComponentsOf, renderDocument, tableOfContents } from "@monti-cms/core/render";

const entry = (await cms.read.getEntry({ collection: "post", slug, locale })).entry; // the document and its refs
// in a server component: the images and files come from entry.refs, the language from entry.locale,
// the blocks, code settings and plugin components from the site of `cms`
<CmsContent cms={cms} entry={entry} components={components} />;
tableOfContents(entry.doc); // the headings of levels 2 and 3, the same anchors, no React
// a document on its own:
const { content, toc, unknown } = await renderDocument(doc, { site: cms.site, locale, refs, components });
<CmsContent cms={cms} doc={doc} refs={refs} locale={locale} components={components} />;
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
  `marks: { tooltip: ({ content, children }) => … }`. The type of `components` (`DocumentComponentsOf<typeof cms>`, or `DocumentComponentsFor<typeof config>`) is built from the `blocks` of `cms.config.ts` and of its plugins
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
- `afterCommit(event, cms)` of the server side (next to `hooks`) is the same notification as `hooks.afterCommit` (delivered from the outbox, retried, at least once, "Event delivery") but also gets the instance, so a subscriber that needs its storage, the store or the formats keeps no state of its own. A plugin that has both is one subscriber, `plugin:<name>`, that runs `hooks.afterCommit` first.
- `commands` of the server side adds command line commands: `monti <plugin name>:<command> [options]` loads the app like `monti migrate` (`--env-file`, `--no-env-file`, `--server`), runs `command.run({ cms, args, log, error })` and exits with the code it returns. The command declares its `options` (`{ name: { type: "string" | "boolean", description } }`); `--help` lists them. `monti git-sync:pull` is one.
- `exportBodyText(cms, { format, doc, locale, scope? })` of `@monti-cms/core/plugin/server` writes a stored document as text in a format of the instance for importing again (`purpose: "sync"`, links as the real path of their target), as the admin export does. For a plugin that keeps bodies somewhere else.
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
| `auth` | Admin login, from `@monti-cms/auth`: `auth({ providers: [github({ clientId, clientSecret, admins })], host?, devBypass?, basePath?, secret? })`. `basePath` is the login API path (default `/api/cms/auth`, see "Login path"), and `secret` is the value that signs login sessions (if unset, the `AUTH_SECRET` environment variable). In a Next.js app, `host` is `nextHost` of `@monti-cms/nextjs/auth` |
| `trustHost` | Optional. Whether `Host` and `X-Forwarded-Host` can be trusted ("Host trust"). Default: the `AUTH_TRUST_HOST` environment variable, else off in production and on in development |
| `secret` | Master secret for values plugins keep encrypted in the DB (AI service keys). Plugins never see it: each gets a key derived from it and the plugin name ("Plugin secrets"). Keep it separate from the login signing value. |
| `previousSecrets` | Optional. Secrets `secret` replaced. Values encrypted with them stay readable and are encrypted again with `secret` when saved again, so changing `secret` does not make stored keys unreadable. |
| `publicApi` | Optional. Public JSON API (`/api/cms/v1/public/entries`, `/entries/:collection/:slug`; published content only, no login, not cached). `{ collections, filters?: { queryName: relationField }, toJson?(entry, { body }) }` |
| `hooks` | Optional. Hooks on every content write: `transform`, `validate`, `validatePublish` and `afterCommit` (a notification after the change is committed: cache revalidation, webhooks, search indexing; retried when it fails, so it must be idempotent). See "Hook contract" and "Event delivery". Plugins can set `hooks` too |
| `events` | Optional. How `afterCommit` deliveries are retried and kept: `{ maxAttempts?, backoffMs?(attempt), retentionDays?, retrySecret? }`. See "Event delivery" |

To use another store or login, build and pass your own `DatabaseAdapter`, `MediaAdapter` or `AuthAdapter`.

### Host trust

A client can send `Host` and `X-Forwarded-Host` itself, so the server does not trust them by default in production. Trusting them means two things: login callback URLs are built from the request host, and the same-origin check accepts the first value of `X-Forwarded-Host`.

- Behind a proxy or on a platform that sets those headers (Vercel, nginx, a load balancer), turn it on with `trustHost: true` in the server config, or `AUTH_TRUST_HOST=true`. The option wins over the variable.
- Otherwise set `AUTH_URL` to the site's public URL. It fixes the origin login uses, so login works without trusting the host. For the same-origin check, set `site.url` so the public host is accepted.
- Default: the `AUTH_TRUST_HOST` variable, else off in production and on in development and tests (the host is `localhost` there). Without it, login on a production server fails with an `UntrustedHost` error (and a warning that names these options).
- Vercel is no longer trusted automatically: add `AUTH_TRUST_HOST=true` to the project's environment variables.

### Login bypass for development

`auth({ devBypass: true })` (`CMS_DEV_AUTH_BYPASS=1` in the generated config) treats the visitor as the first admin without login. It is limited so a staging server cannot be opened by accident:

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
		afterCommit: (event) => revalidate(event.collection, event.publishedSlug),
	},
});

export const cms = createCms({ server });
```

| Stage | What runs |
|---|---|
| 1 | Build the input: from the request, or from the stored draft (publish, bulk) |
| 2 | `transform` hooks, in registration order (server config first, then the plugins in config order). Each gets the previous one's result |
| 3 | Core preparation: normalization, reference collection, core validation. **Always runs, on the transformed data** |
| 4 | The `validate` of each block (warnings only), then the `validate` hooks: extra failures and warnings |
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
- `afterCommit` gets the event: ids, status, slugs, `version`, `contentHash`, `eventId`, and `read()` for the committed entry (never the body itself). Delivery is from an outbox: at least once, in order per entry, retried when it fails. See "Event delivery".

Contracts (each has a test in `src/services/__test__/write-hooks.test.ts` and `write-pipeline.test.ts`):

1. **Transformed data still goes through core.** Normalization, reference collection and validation run on what a `transform` returns, so a transform cannot get a value past a core check.
2. **Extra validation can only add failures.** `validate` and `validatePublish` return issues and warnings that are added to the core ones. They get a copy of the snapshot, so they cannot remove or downgrade a core issue, and the core integrity checks of a publish (references, media, links, required values) always run.
3. **A failure before the commit blocks the write.** A failing core preparation, a failure a hook adds, or a hook that throws stores nothing and does not call `afterCommit`.
4. **An `afterCommit` failure never undoes a completed write.** It is recorded and retried, and the other `afterCommit` hooks still run. The event is written in the transaction of the write, so a write that rolls back leaves none.
5. **Bulk applies the same hooks to every item.** Each item runs the full pipeline, and its result or error (`hook_failed`, `validation_failed`, ...) is reported per item.

## Event delivery (`afterCommit`)

`afterCommit` is delivered from an outbox, so it survives a failing subscriber and a stopped process.

- **The outbox.** In the same transaction as a change, the store inserts a row into `cms_events` (migration `0022_events`): `id`, `kind` (`created`, `saved`, `published`, `archived`, `unarchived`, `trashed`, `restored`, `deleted`), `entry_id`, `collection`, `locale`, `content_hash`, `version`, `occurred_at` and a `payload` with the status and slugs. A change that rolls back leaves no event; a change that commits always has one. A create or save that publishes at once writes two events (`created`/`saved`, then `published`). There is no foreign key to `entries`, so the event of a deletion outlives the entry. A change to a source's translations is reported once, for the entry it was made on (`translationGroupId` names the group).
- **Subscribers.** The server config's `hooks.afterCommit` is the subscriber `server`; each plugin's `hooks.afterCommit` is `plugin:<plugin name>`. The name is stable and keys the delivery state in `cms_event_deliveries` (one row per event and subscriber: `state`, `attempts`, `last_error`, `next_attempt_at`), so do not rename a plugin that has one. A subscriber added later gets the events committed after it appears, not the history.
- **Delivery.** After the commit, the process that made the change tries each subscriber right away, in the same call, so latency is what it was before. A failure is recorded and retried later with a growing delay (15 seconds, doubling, at most an hour; `events.backoffMs` changes it) and the delivery is dead-lettered (`dead`) after `events.maxAttempts` tries (default 8). The write is never undone, and the other subscribers are not held back.
- **At least once, in order per entry.** An event can be delivered more than once (a subscriber that did its work and then failed, a try that never finished), so **a subscriber must be idempotent**: it receives `event.eventId`, the same on every try, to remember what it handled. Events of one entry are delivered in commit order: an event waits while an earlier event of the same entry is pending, in flight or failing and not dead. A dead or dismissed delivery no longer holds the order, so a manual retry of a dead one can arrive after later events; a subscriber that exports the entry reads its current state and compares `version`. Events of different entries are independent.
- **Reading the committed entry.** `event.read()` returns the entry as it is now (`Entry`, with the working and published documents) or `null` when it was deleted. `event.version` and `event.contentHash` say which change this event is: when `read().version` is higher, a later event for the entry follows. A subscriber that exports an entry through a format (git-sync) reads it, runs the format and skips the event if the version it wrote is already newer.
- **Deferring.** A subscriber that is not ready yet (it batches events, or knows when a rate limit ends) returns `{ retryAt: Date }` or throws `new DeferDelivery(retryAt)` (`@monti-cms/core/server`, `@monti-cms/core/plugin/server`). The delivery goes back to `pending`, due at `retryAt`. It is **not a failure**: nothing is logged, it is not listed on the Events screen, it is not in the failed badge, it does not use an attempt (`attempts` goes back by one, so a delivery deferred any number of times is still on its try) and it can never dead-letter. It still holds the order of the entry's later events. `cms.events.retry()` returns how many were `deferred`; `retry({ all: true })` also tries deferred deliveries that are not due yet. git-sync uses this for its batch window.

```ts
// git-sync/server.ts, the `server` module of the plugin (`definePlugin({ name: "git-sync", server: () => import("./server") })`)
import type { CmsServerPlugin } from "@monti-cms/core";

const plugin: CmsServerPlugin = {
	hooks: {
		// Delivered at least once: use `event.eventId` to skip an event this subscriber already handled.
		afterCommit: async (event) => {
			if (await alreadyHandled(event.eventId)) return;
			const entry = await event.read(); // the committed entry, or null if it was deleted
			await pushToGit(event, entry);
			await markHandled(event.eventId);
		},
	},
};
export default plugin;
```

### Retries without a worker

Nothing runs in the background, because the site may run on serverless functions. A retry starts from:

- **The next write in the same process.** After its own events, a write runs up to 5 due retries, at most once every 10 seconds per process.
- **`cms.events.retry({ all?, limit? })`.** Delivers what is due (with `all`, also failed deliveries that are not due yet; dead ones only by hand). It also delivers events that have no delivery rows because the process stopped between the commit and the delivery. It returns `{ delivered, failed, dead }`. `cms.events.list()`, `counts()`, `retryDelivery({ eventId, subscriber })` and `dismiss({ eventId, subscriber })` are what the admin uses.
- **`monti events:retry [--all] [--limit <n>]`.** Loads the server file like `monti migrate` and calls `cms.events.retry()`; run it from a cron job or a CI schedule.
- **`POST /api/cms/v1/events/retry[?all=1&limit=100]`.** For a scheduler that can only call a URL (a Vercel cron, say). It takes an admin session, or `Authorization: Bearer <retrySecret>` when the server config sets `events.retrySecret` (keep it in an environment variable; it is not part of `cms.server`).

```ts
defineServerConfig({
	// ...
	events: { retrySecret: process.env.CMS_EVENTS_SECRET, maxAttempts: 8 },
});
```

Finished events are removed after `events.retentionDays` days (default 30), by the same write-driven pass. The admin's **Events** screen (`/admin/events`) lists the failed and dead deliveries with their last error, and retries or dismisses each; the sidebar shows how many there are.

## The schema file

`monti.schema.json` at the site root holds the plain-data part of the site config: the collections with their fields and layouts, the locales and the default locale, the time zone, the plain-data `site` settings, `admin` (the path, the language and string text overrides), the seed templates (stored documents, or a text and its format), the `schemaVersion` and the data transforms (`migrations`, see "Changing the schema").
It is a repo file, not code the bundler runs, so a tool can read and write it, and types are generated from it.

```json
{
	"$schema": "./node_modules/@monti-cms/core/schema.json",
	"collections": {
		"post": {
			"label": "Post",
			"kind": "document",
			"path": "/posts/:slug",
			"fields": {
				"title": { "kind": "text", "label": "Title", "required": true, "max": 200 },
				"slug": { "kind": "slug", "label": "Address", "from": "title", "required": true },
				"categoryId": { "kind": "relation", "label": "Category", "to": "category", "required": true },
				"stage": { "kind": "select", "label": "Stage", "options": { "idea": "Idea", "done": "Done" }, "defaultValue": "idea" }
			},
			"layout": [{ "fields": ["title", "slug"] }, { "group": "Classification", "fields": ["categoryId", "stage"] }]
		},
		"category": {
			"label": "Category",
			"kind": "item",
			"fields": {
				"title": { "kind": "text", "label": "Name", "required": true },
				"slug": { "kind": "slug", "label": "Address", "from": "title" }
			}
		}
	},
	"locales": [{ "code": "en", "name": "English" }, { "code": "fr", "name": "Français" }],
	"defaultLocale": "en",
	"timeZone": "Europe/Paris",
	"site": { "name": "My blog", "localePrefix": "always" },
	"admin": { "path": "/studio" }
}
```

**Format.** Each part is the options object of the matching builder, with its `kind`: a collection is what `defineCollection` takes (`label`, `kind`, `body`, `fields`, `path`, `icon`, `layout`, `list`), and a field is what `fields.<kind>` takes with `"kind"` added. The field kinds are `text`, `slug`, `relation` (`many`, `ordered`, `createInline`, `publishedOnly`, `allowUnpublished`),
`select` (`options` and `defaultValue`), `media` (`accept: "image" | "file"`: the image field), `conditional` (a `discriminant` select and the `values` that show for each option), `backlink` and `view`: every kind `fields.*` has. `fields.*` has no date, boolean or number kind today, so the file has none. A collection that holds a date keeps it in a text field.
`$schema` points to `@monti-cms/core/schema.json`, a JSON Schema generated from the same definition the runtime check uses, so editors autocomplete keys and flag a wrong `kind` or a misspelt option as you type (rules between collections, such as a relation to a collection that exists, are checked when the config loads).
**There are no retired aliases:** `workflow` and `required: "publish"` are errors (use `kind` and `required: true`).

**Loading.** `cms.config.ts` passes the parsed file to `defineConfig`. An `import` is what the bundler ships with the build, so the file is read-only in production (needs `"resolveJsonModule": true`, which `create-next-app` sets). A path string (`schema: "./monti.schema.json"`) is read at run time, relative to the working directory, and works in Node only (scripts, tests):

```ts
import { defineConfig } from "@monti-cms/core";
import { mdx } from "@monti-cms/mdx";
import schema from "./monti.schema.json";

export default defineConfig({
	schema,
	site: { url: process.env.HOST_URL || undefined }, // differs per environment
	plugins: [mdx()],
});
```

`createCms`, `createSite` and everything else take that config like any other, so any number of sites with their own files live in one process. A file that is not valid stops the app at start with every problem and its JSON path:

```text
monti.schema.json is not a valid schema file:
  collections.post.fields.title.kind: a field needs a "kind" of text, slug, relation, select, media, conditional, backlink or view
  collections.post.workflow: is not part of the schema format
  locales[1].code: must look like "en", "pt-BR" or "zh-Hant"
```

**How the file and the code config merge.** Code adds to the file and may override what differs per environment, but it never silently replaces the file's data:

| Part | Rule |
| --- | --- |
| `collections` | The file's collections, then the ones written in code (`defineCollection`). The same name in both is an error |
| `locales`, `defaultLocale`, `schemaVersion` | Only in the file. Setting them in code too is an error (`schemaVersion` can be set in a config that has no schema file) |
| `site`, `admin` | Key by key, the code's value wins. A key set to `undefined` (an unset environment variable) leaves the file's value. `site.url` usually lives in code |
| `timeZone` | The code's value wins |
| `seed.templates` | The file's templates, then the code's |
| `plugins`, `blocks`, `codeBlock`, `media` | Code only |

**What stays in code.** Anything that needs code: plugins (so syntax extensions, formats, AI actions), block definitions with their components, hooks and the server config (storage, login, secrets), `codeBlock` (line effects hold labels and functions), `media`, and any option that is a function. `site.url` stays in code because it differs per environment.

**Plugins that add fields.** `seoFields()` and the like return plain field objects, so their fields already have a JSON form: they are written into the file as ordinary fields (`monti schema:extract` does it), and the plugin (`seo()`) stays in `plugins` and checks them by role as before.
There is no separate "plugin field" in the format. A collection written in code can still spread `seoFields()`. Labels in the file are one language's text (`monti schema:extract --locale` picks it).

### Types: `monti schema:types`

`monti schema:types` reads the file and writes `monti-env.d.ts` next to it (`--schema <file>`, `--out <file>`): a declaration that registers the collections, their fields and the locales in the `MontiRegister` interface of `@monti-cms/core`. With it, `defineConfig({ schema })` returns the same types a TypeScript config does,
and `createCms`, `cms.read`, `MetadataFor`, `CollectionName` and `DocumentComponentsFor<typeof config>` know the collection names, the metadata of each (a select's options, a many relation as `readonly string[]`, the fields of a conditional field) and the locale codes. The site writes no types. The file holds types only (no import at run time), is not edited by hand, and is committed like `next-env.d.ts`.

- `monti schema:types --watch` keeps running and rewrites the file when the schema changes (a half-written file is reported and the last good types stay).
- `withCms` (`@monti-cms/nextjs/config`) does that inside `next dev`, so the types follow the file with no extra command. A production build does not touch it.
- `monti schema:types --check` writes nothing and exits with 1 if the file is out of date (for CI).
- Without the generated file the names are plain `string`s. An app has one registered schema; a second schema in the same app passes its content with literal types (`defineConfig({ schema: { ... } as const })`) to be typed.

### Moving a TypeScript config: `monti schema:extract`

`monti schema:extract` loads `cms.config.ts` (`--config <file>`), writes its data part to `monti.schema.json` (`--out <file>`, `--overwrite` to replace an existing one, `--locale <code>` for the language of plugin-provided labels) and `monti-env.d.ts` (`--no-types` skips it), and prints what stays in code.
It never edits `cms.config.ts`; it prints the slim config to put there:

```text
Wrote monti.schema.json (5 collections, 2 locales, 3 seed templates).
Wrote monti-env.d.ts (the types of the schema; run `monti schema:types --watch` while you edit it).

Stays in code (cms.config.ts):
  - site.url: differs per environment, so it is read from the environment in code (`site: { url: process.env.HOST_URL }`)
  - plugins: mdx, callout, ..., seo, ai, text-check-bareun (code; the fields they add to collections are in the schema)
```

Then replace the collections, locales, `defaultLocale`, `timeZone`, `seed` and the data part of `site` and `admin` in `cms.config.ts` with `schema`, keeping `plugins` and the rest. Loading the result back gives the same site (a test extracts and reloads the reference configs and compares them).

### Changing the schema: `monti schema:diff` and `monti schema:apply`

Removing a field or a select option is routine once the schema is edited. The data does not break (a removed field or option keeps its stored values as "orphans": publishing warns, the public read hides them), and nothing is dropped unless you say so. Two commands and a few functions make a change **safe and explainable**: they show which entries a change touches before it is saved, run data transforms you declare, and record which schema every entry was written under.

**The applied schema.** The database remembers the schema that was last applied (`monti schema:apply`): its `schemaVersion` and its data model (collections, fields, options, locales, allowed blocks) as a JSON snapshot in the `schema_state` table. That snapshot is the old side of every diff, because it is exactly what the stored data was last conformed to (a branch or tag of the repo can differ from it). A store that never applied one is at its **baseline**: the first `schema:apply` records the schema and changes no entry. So the migration path of an existing blog is `monti schema:extract`, then `monti schema:apply` with no transforms, which is a no-op.

**`schemaVersion`.** A whole number from 1 in the schema file (1 if it is left out; `monti schema:extract` writes it). Every entry body records the version it was written or transformed under (`entry_bodies.schema_version`). The version is **not part of the content hash**: `computeContentHash(metadata, doc)` is defined over a constant, so every hash stored so far stays as it is, and a schema change that does not touch an entry's content does not make it look edited. Saving the same content under a newer version changes nothing (no new entry version, no new modified date; the stored version stays), and an edit is stored under the site's current version. `schema:apply` raises the number in the file when the schema changed (or transforms are pending) and the file still has the old one; commit the file. A file that already carries the raised number (applied on a development machine, then deployed) is left alone, so the production run records the same version and writes nothing to the file.

**Transforms** live in the schema file, in `migrations`, next to the schema they belong to. Each has an `id` (a name for good: it is recorded in `cms_migrations` as `schema:<id>` once it ran, like `storage.once`, so it never runs twice, and applied ones stay in the list as history), an `op` and the names of the schema **after** the change:

```json
{
	"schemaVersion": 3,
	"collections": { "post": { "fields": { "excerpt": { "kind": "text", "label": "Excerpt" }, "stage": { "kind": "select", "label": "Stage", "options": { "idea": "Idea", "done": "Done" }, "defaultValue": "idea" } } } },
	"migrations": [
		{ "id": "2026-10-rename-summary", "op": "renameField", "collection": "post", "from": "summary", "to": "excerpt" },
		{ "id": "2026-10-merge-draft", "op": "mapOption", "collection": "post", "field": "stage", "from": "draft", "to": "idea" },
		{ "id": "2026-10-drop-legacy", "op": "dropField", "collection": "post", "field": "legacy", "note": "no longer used anywhere" },
		{ "id": "2026-10-author-default", "op": "setDefault", "collection": "post", "field": "author", "value": "Staff" }
	]
}
```

| `op` | What it does |
| --- | --- |
| `renameField` | The value of `from` moves to `to`. Nothing is overwritten: an entry that already has a value under `to` keeps both, and the apply reports it. `to` must be a field of the schema (or the `from` of a later rename, for a chain), and `from` must not be |
| `mapOption` | A stored select value that is no longer an option becomes another option of the field, also inside a list of values (without duplicates) |
| `dropField` | **Deletes** the stored values of a field the schema no longer has. The only transform that deletes data; it is an error if the schema still has the field |
| `setDefault` | An entry with no value for a text or select field gets `value` (a field that became required, say). In a conditional branch it only fills entries the branch shows, and a translation only gets it for a per-language field |

Moving a field into or out of a conditional branch needs no transform: every stored value is kept wherever its field is (conditional values are stored flat), so the data does not move. The diff reports it (`field_moved`) and the check counts the entries whose value the new branch does not show. A **collection** rename is not a transform: the collection name is a stored value (`entries.collection`, folders, addresses), so a renamed collection is a removed one plus an added one; the diff points out a pair that looks alike (`renameHints`) and nothing is applied.

**Nothing is dropped silently.** A removal with no `dropField` keeps the orphans exactly as before. A transform that does not fit the schema (a drop of a field the schema still has, a mapping to something that is not an option, a default that is not valid for its field) is a problem and the apply refuses to start. If one entry cannot be rewritten, nothing at all is changed.

**How a transform writes.** Every transform runs through the write rules (`prepareSnapshot`, without the write hooks): the changed metadata is checked, and the content hash, the search text and the metadata references (a renamed or dropped relation or media field moves or removes its reference, so deletion checks stay right) are recomputed from it. Working and published bodies are rewritten the same way in one transaction, and `version` and `updated_at` of the entry and its bodies are kept, as in the data migrations before: an entry that had unpublished changes still has them, one that did not still does not. A transformed body is stamped with the new version. The run holds the lock the migrations use, so two applies at once run each transform once.

**Commands.**

- `monti schema:diff [--schema <file>] [--check]` (read-only) compares the schema of the app with the applied one and prints every change with the entries it touches and what happens to them: kept as orphans, rewritten by a transform, deleted by a `dropField`, cannot be published until filled, and so on. With `--check` it exits 1 when there is anything to apply.
- `monti schema:apply [--schema <file>] [--dry-run]` migrates the store (`monti migrate`), runs the transforms that did not run yet, records the schema and its version, and raises `schemaVersion` in the file when needed. It is idempotent. `--dry-run` runs everything in a transaction that is rolled back and writes nothing, not even the file.

```text
$ monti schema:diff
Applied schema version: 2. After the apply: 3.
Changes (3):
  - post.summary renamed to excerpt [transform 2026-10-rename-summary]: 12 entries ("Hello", "Notes", ...); rewritten by its transform
  - post.stage option "draft" removed [transform 2026-10-merge-draft]: 4 entries ("WIP", ...); rewritten by its transform
  - post.legacy removed (text): 2 entries ("Old post", ...); values kept as orphans (hidden from the public read; publishing warns)
Transforms to run (2): 2026-10-rename-summary, 2026-10-merge-draft
```

**The API (what a settings screen calls).** `@monti-cms/core/schema-change` exports plain functions over the instance's store and site:

| Function | What it gives |
| --- | --- |
| `diffSchema(old, new, { transforms })` | `{ changes, renameHints }`. A change is one of `collection_added`, `collection_removed`, `collection_kind_changed`, `body_changed`, `allowed_changed`, `field_added`, `field_removed`, `field_renamed`, `field_type_changed`, `field_required_changed`, `field_locale_changed`, `field_moved`, `option_added`, `option_removed`, `option_renamed`, `locale_added`, `locale_removed`, `default_locale_changed`. A `renameField` or `mapOption` transform turns a removal plus an addition into a rename; a change a transform handles has `handledBy`. `changeKey(change)` is a stable key for a list, `describeSchemaChange(change)` an English sentence. Pure |
| `checkSchemaChange(store, diff, { site, transforms, sampleSize })` | Per change: `entries` (an entry counts once), a `sample` of ids and titles, the `consequence` and whether it was `checked`. It reads every stored body once and writes nothing. `site` (the new schema's) is needed to check allowed-blocks changes and required fields in a branch |
| `suggestTransforms(change, { options, renameTo })` | The transforms that fit a change (a drop, a rename, a mapping per remaining option, a default), without ids, for a screen to offer |
| `planSchemaChange({ site, store, migrations })` | The diff against the applied schema, the pending transforms, `problems`, the `nextVersion` and whether the file needs a raise (`needsVersionBump`). Read-only |
| `applySchemaChange({ site, store, migrations, dryRun })` | Runs the plan. Returns what ran, how many entries and bodies each transform changed, and the `conflicts` of renames. Throws `SchemaChangeError` (changing nothing) |
| `applyTransforms`, `checkTransforms` | The pure pieces: one entry's metadata through the transforms, and the check of transforms against a schema |

The store side is the `SchemaChangeStore` port (`readSchemaState`, `appliedSchemaTransforms`, `scanBodies`, `applySchemaChange`), part of `ContentStore`.

### Editing the schema in the admin (development only)

The admin has a **Schema** screen (`<admin path>/schema`, in the sidebar under "Manage") that edits `monti.schema.json`. It is a thin layer over the API above: the same diff, impact check and transforms, with the file written for you.

**Who may write.** Only a server that runs in development (`NODE_ENV=development`, which `next dev` sets) and whose schema file exists and can be written. The decision is made on the server (`schemaEditAccess(cms)` of `@monti-cms/core/schema-edit`), not by the screen: in production `PUT /api/cms/v1/schema` and `POST /api/cms/v1/schema/preview` answer **403 `schema_read_only`** (with a `reason`: `production`, `no_schema_file` or `not_writable`), and the screen shows the schema read-only with a short explanation. `GET /api/cms/v1/schema` works everywhere (a production server only reads the file). Every route needs an admin, like the rest of the admin API, and the write routes also check the same origin.

**The routes** (`/api/cms/v1/schema`, served by `cms.handle()`):

| Route | What it does |
| --- | --- |
| `GET` | The file's content and `hash`, whether it can be written (`access`), its `issues` if it does not check (with JSON paths), the applied version, the collections the config adds in code, and the block and mark names a body list can use |
| `POST /preview` | Body `{ schema, transforms?, renames? }`. Checks an edit and writes nothing: `valid` and `issues` (JSON path and message), the `impacts` of every change (entries touched, a sample of ids and titles, the consequence), the `decisions` (changes whose stored values can be treated in more than one way, with the `suggestTransforms` choices and the one in effect), the `transforms` that would be recorded and their `problems`, and `nextVersion` |
| `PUT` | Body `{ schema, transforms?, renames?, baseHash }`. Saves the edit (below). `409 schema_conflict` when the file changed since `baseHash`, `400 invalid_schema` with `issues`, `422 invalid_transforms`, `500 schema_apply_failed` (the file was written, the database was not changed) |

`transforms` are the picks of the writer, without ids (the server names them `v<version>-<op>-<collection>-<field>`). Left out, the server picks for each decision: a rename when the screen reports one in `renames` (a field or option the writer renamed), a mapping or a drop only where **no stored entry** holds the value (a drop that would delete values is never picked for the writer), a default only where it has a value. Without a pick the values stay as orphans, as before.

**What a save does, in this order**, stopping at the first failure:

1. Checks the file format and `defineConfig`'s rules on the edited content, and the transforms against it. The save is refused if the file changed on disk since the edit started.
2. Dry-runs the transforms on the dev database, so an entry that cannot be rewritten stops the save before the file is touched.
3. Writes `monti.schema.json` with the picked transforms appended to `migrations` and `schemaVersion` raised. The old text is kept wherever it did not change (hand-formatted arrays, spacing, key order, the trailing newline) and the new parts are written in the file's own indentation, so the change is a small diff (`formatSchemaText`).
4. Writes the generated types (`monti-env.d.ts`), as `monti schema:types` does.
5. Runs `applySchemaChange` against the dev database (creating the tables first if there are none), which also records the schema as applied.
6. Reloads the running instance (`cms.reloadSchema()`); the screen then reloads the admin page.

**How the running instance picks up the schema.** An instance made from `defineConfig({ schema })` remembers how to rebuild its config with another schema, and the schema file's path (`cms.schemaFile()`, found as `monti.schema.json` or `src/monti.schema.json` in the working directory, or given as `schemaFile` to `createCms`). In development it swaps its site, store, services, read API and handlers **in place** (the same `cms` object, the database connections shared) when the settings screen saved, and also on its own when it finds the file changed on disk (a hand edit, or a save from another process; it looks at most every 250 ms). A file that does not read or check is reported once and the instance keeps the last good schema. So the admin shows a saved change without restarting `next dev`; the types are kept by the watcher of `withCms` and by the save itself. In production `cms.reloadSchema()` does nothing: a production server runs the schema it was built with. `cms.forSchema(schema)` builds another instance over a schema without installing it; the settings screen uses it to check an edit.

The screen edits collections (label, icon, kind, public address, body and the allowed blocks, marks and heading levels), every kind of field with its options (add, remove, rename, reorder, required and languages, select options, conditional branches), layout groups, list columns, the locales and the time zone. It does not edit what is plain data but rarely changes (`site`, `admin`, `seed`, recorded `migrations`): they are shown, and edited in the file. A collection written in code (`cms.config.ts`) is not in the file, so the screen lists it as not editable.

## Config

Everything in this table except `codeBlock` and `media` can be written in the schema file instead ("The schema file"), and `plugins` and `blocks` are always code. The rules below are the same either way.

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
| `admin.templates` | `false` hides body templates in the admin: the template menu of the editor, the sidebar link and the Templates screen (a 404). Default `true`. Stored templates are kept. |
| `admin.translations` | `false` hides the translation UI in the admin: the language tabs of the editor, the locale column and filter of the list, and the language tabs of the item panel. Default `true`. A site with one locale never shows it, whatever this says. |

### Collections

- **Kind (`kind`).** A `document` has a body, separates draft from published content, and is published explicitly. An `item` is a small form whose saved values
  are reflected in the public value immediately (no publishing, archiving or translations; per-language values go in `translations`). The body (`body`), if absent, is used only by documents. `body` can also be an object that limits the blocks, marks and heading levels the body allows ("Allowed blocks and marks per body").
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

The package's own tests run against the sample site `testSite` (`test/site.ts`, made from the sample site config `test/cms.config.ts`). A test that needs an instance builds one with `fakeCms` (or `createCms` over fake adapters), and one that needs its own config builds a site or an instance from it; no test mocks a module for it.

**Tests also run with another site config (regression guard).** `test/other-site.config.ts` is a config deliberately different from the blog's (collections article, topic and author,
field names other than `title` and `slug`, English only, chart + site blocks, no text decorations). In each of the core, admin and AI packages, `vitest.othersite.config.ts` reruns the same
tests with this config (it sets `MONTI_TEST_SITE=other-site`, which `test/site.ts` reads) (suite names `core (other-site)`, `admin (other-site)` and `ai (other-site)`; the repo-root
`pnpm test:run` runs them together, and in a package use `pnpm test:other-site`). New tests run with both configs automatically. Do not write collection and field names in
tests; look them up from the config (`test/any-site.ts`: collections, relation fields, the second language, and `fillRequiredMetadata`, which fills in publish-required values).
Wrap tests that need something the config lacks (a second language, a bundled block, etc.) in `skipIf`. In the core package, the parts that assert the blog sample data as is
live in `*.blog.test.ts` and are excluded from the other-site run and type check. In the admin and AI packages, list them in `BLOG_FIXTURE_TESTS` of each `vitest.othersite.config.ts`
to exclude them.

**Automated checks (CI).** On every push and PR, `.github/workflows/ci.yml` runs lint (check only), type checking, the package build, tests (Postgres 17 service) and
the example app bundle check (`pnpm example:check`). `pnpm example:check` builds and packs the packages, installs them into the example app in a temporary folder outside the repo,
and runs `tsc` (`skipLibCheck: false`) and `next build` once each with a config that includes all the example config and extensions.
