# Example app: blog

English | [한국어](README.ko.md)

A personal tech blog on `@monti-cms/core`, modelled on the maintainer's own blog: collections Post, Memo, Category, Tag and Series (the `collection` collection), in Korean (the default) and English. It attaches everything
the blog uses, one plugin per line in `monti.config.ts`: every body block (`@monti-cms/blocks`: `callout()`, `collapsible()`, `tabs()`, `columns()`, `mermaid()`, `chart()`, `tooltip()`, `codeRef()`, `color()`, `codeExplorer()`), the SEO fields (`@monti-cms/seo`), the AI plugin (`@monti-cms/ai`),
an example admin extension of its own (a word-list spell check, `plugins/word-list`) and MDX written in the directive notation (`mdx({ syntax: [directiveSyntax()] })` of `@monti-cms/mdx` and `@monti-cms/syntax-directive`, write mode on, so a post body reads `:::callout{…}`).
Packages are installed from **built bundles** (`vendor/*.tgz`), not from the repository sources.

```sh
# From the repo root: build the packages and pack them into vendor/
pnpm example:pack

# In this folder
pnpm install --ignore-workspace
cp .env.example .env.local   # fill in DATABASE_URL and MONTI_SECRET (the rest is for GitHub login in production)
pnpm db:migrate               # = monti migrate
pnpm dev                     # http://localhost:3000/studio
```

pnpm 12 stops the install unless the esbuild install script is allowed. Copy this folder out of the repo, put `allowBuilds: { esbuild: true }` in `pnpm-workspace.yaml`, and install with `pnpm install` (with `--ignore-workspace` that setting is not read). pnpm 10, which the repo uses, only warns.

`next dev` signs you in as the admin without any login settings, for requests from your own machine (`localhost`) only. There is no variable for it: it is the default under `next dev`, it never applies in production, and `auth({ devBypass: false })` turns it off (auth README, "Dev bypass"). Deploying on Vercel, Netlify or Cloudflare Pages needs nothing more for login; behind a proxy you run yourself (nginx, a load balancer) set `AUTH_TRUST_HOST=true`, but only if that proxy overwrites `X-Forwarded-Host` (core README, "Host trust").

## Files

The shape is what `monti init` generates, plus this site's collections and extensions.

| File | Contents |
| --- | --- |
| `monti.schema.json` | The site's data, in the schema file format of the core README ("The schema file"): collections (`post`, `memo`, `category`, `tag`, `collection`), the record fields, the SEO fields (as plain fields), the layouts, the locales, the time zone, the seed templates, admin path `admin.path: "/studio"`, URL rule `site.localePrefix: "always"` (`/ko/posts/…`, `/en/posts/…`), and the preview language from the path (`previewLocaleParam: false`). Editors autocomplete it through its `$schema` link |
| `monti-env.d.ts` | The types of the schema file, written by `monti schema:types` (`next dev` rewrites it when the schema changes, and `pnpm example:check` fails if it is out of date). With it `cms.read` and the theme know the collection names and the metadata of each, with no type written by hand. Not edited by hand |
| `monti.config.ts` | The one config file, and the CMS instance: it exports `cms = defineConfig({ schema, plugins, database, auth })` (`defineConfig`, `postgres` from `@monti-cms/core/server`; `auth` and `github` from `@monti-cms/auth`). The plugin list has one line per feature (`mdx` with the directive notation, each block, `seo()`, `aiPlugin()`, `wordList()`, `gitSync()` switched off), and `site.url` is read from `SITE_URL` (the convention of `defineConfig`). The database, login and secret come from the environment (`.env.example`). The admin, the API route, the site pages (`cms.read.*`) and the `monti` command all import `cms` from it. It is server-only: loading it in a browser throws, and `pnpm exec monti check:boundary` fails when a `"use client"` file imports it (directly or through other files); `next dev` warns about the same |
| `app/studio/` | The admin screen: `layout.tsx` (imports the prebuilt `@monti-cms/admin/styles.css` and `@monti-cms/blocks/styles.css`, renders `CmsAdminLayout`) and `[[...path]]/page.tsx` (renders `CmsAdminPage`), using `@monti-cms/nextjs/admin`. The layout is separate from the page so the admin is not remounted on every screen change (nextjs README, "Files") |
| `plugins/word-list/` | The example admin extension, a spell check of your own written as a plugin: `index.ts` (`definePlugin` naming its admin side), `admin.ts` (`defineAdminPlugin({ Provider })`) and `provider.tsx` (the client component that wraps the admin with `CmsAdminComponentsProvider`). It is one line in `plugins: [...]` of `monti.config.ts` |
| `components/monti/blog-theme/` and `app/(site)/[locale]/posts/` | The post list and post pages, installed as source with `pnpm exec monti add blog-theme --registry ../../registry/r` (from this folder). The command writes the route files to `app/(site)/blog/`; here they were moved to `app/(site)/[locale]/posts/` (the site uses `/ko/...` URLs), and the pages read `params.locale` from there. `components/monti/blog-theme/theme.config.ts` is the one file edited after the install: the collection (`post`), `routeBase` (`/posts`), the tag relation (`tagIds`) and the summary field (`summary`). The blocks need no `components`: the plugins bring their public components. Running the command again would write the route files to `app/(site)/blog/` once more, so delete that copy |
| `app/(site)/[locale]/memos/` | The memo list and memo page. The theme reads one collection, so these two small pages are written by hand with the same `cms.read` API and `ArticleBody` |
| `components/monti/article-body/` | The article body, installed as source with `pnpm exec monti add article-body --registry ../../registry/r` (from this folder; `blog-theme` brings it too) and used by the article page. Edit it freely; `monti add` refuses to overwrite a changed file without `--overwrite` ("Components as source" in the core README). `tsconfig.json` has the `@/*` alias it is imported through |
| `showcase/` | The sample content (`*.mdx`) and `seed.ts`, which `pnpm preview:example` runs to put it into the preview database: the "CMS elements" post (every element and every block, in directive notation), a second post that links back, a memo, a category, tags, a series and one unpublished draft |
| `app/api/cms/[...path]/route.ts` | Admin API and login (`/api/cms/auth/*`), served by `createRouteHandler(cms)` of `@monti-cms/nextjs`. There is no separate login route file. With the two files under `app/studio/` these are the three Next files the admin needs |
| `app/globals.css` | The public site's own styles: Tailwind with typography, and the public page styles of the packages (`@monti-cms/core/render.css`, `@monti-cms/blocks/render.css`). It has no admin lines: the admin styles are prebuilt and scoped to the admin, so the site needs no Tailwind setup for them |

To use GitHub login, set the OAuth app's callback URL to `http://localhost:3000/api/cms/auth/callback/github`.

## Git sync (off by default)

`monti.config.ts` lists `gitSync({ enabled: false, targets: [...] })` (`@monti-cms/git-sync`), which syncs the published posts and memos two ways with files in a GitHub repo. It is switched off, so the example needs no token and no repo, and its admin has no "Git sync" screen. To try it:

1. In `monti.config.ts`, set `enabled: true` and put your own `repo` (and `folder`, `branch`, `mode`) in `targets`. The default file path is `{collection}/{slug}.{locale}.{ext}` under the folder, for example `content/post/hello.ko.mdx`.
2. Run `pnpm db:migrate`, make sure `MONTI_SECRET` is set (the token is saved encrypted with a key derived from it), and start the app.
3. Open `/studio/git-sync`, Settings tab: save a GitHub token (a fine-grained token with read and write access to Contents and Pull requests on that repo). To receive pushes, add a webhook in the repo (Settings, Webhooks) with the payload URL shown there, content type `application/json`, the secret you saved, and the push event. The site must be reachable from GitHub for that (a tunnel works for local development).
4. Run `pnpm exec monti git-sync:push --all` once to write every published entry to the repo. From then on a publish commits its file, and a change pushed to the repo (or "Pull now", or `pnpm exec monti git-sync:pull`) comes back to the site.

The package README has the file format, the conflict screen and the pull request mode.

## What differs from the maintainer's blog

The schema file and the config keep the collections, field kinds, layouts, SEO fields, plugins and seed templates of the maintainer's blog, with English labels (schema labels are site content, and this repo has no dictionary for them). The schema file was made from the blog's TypeScript config by `monti schema:extract --locale en` (the SEO fields became plain fields in the file; the plugins and `site.url` stayed in `monti.config.ts`). Left out:

- the blog's own plugin `legacyListColumns()` and `admin.legacyBackupNames`, which only migrate that site's old saved admin settings and old browser recovery copies;
- the locale list and names are written in the schema file instead of coming from the blog's `i18n` module, and `site.url` is read from `SITE_URL` as the blog does;
- the AI style guide is written in English, since this repo keeps config text in English.

## Trying it inside the repo

This does not use the production DB. It creates a `cms_preview_*` schema in the test DB (`CMS_TEST_DATABASE_URL`) and drops it when finished.

```sh
export DATABASE_URL="$CMS_TEST_DATABASE_URL" DATABASE_SCHEMA=cms_preview_example MONTI_SECRET=local-only
# (after creating the schema cms_preview_example)
pnpm exec monti migrate --no-env-file
pnpm exec next dev -p 3997   # http://localhost:3997/studio
```

Do not commit the `AGENTS.md` and `CLAUDE.md` that `next dev` creates in this folder.

## Checking on screen

After a change, open the "CMS elements" sample post in a local preview and look at it. From the repo root:

```sh
pnpm preview:example               # pack the packages, install the example, reset the schema, migrate, seed
pnpm preview:example --seed-only   # same, without packing and installing again
cd examples/blog && pnpm exec next dev -p 3997
```

The command only uses the schema `cms_preview_example` of the test database (`CMS_TEST_DATABASE_URL` in the repo's `.env.local`; it refuses to run without it), writes this folder's `.env.local`, and seeds the content of `showcase/` through the app's own write path (create, save, publish):
the category `showcase`, the tags `monti` and `blocks`, the posts `cms-elements` and `cms-elements-details` (it links back), one unpublished draft post, the memo `showcase-memo`, and the series `showcase-series` that holds both posts.
It stops with an error if publishing reports any issue (the one warning the two posts get from linking to each other before the second is published is expected and ignored). It prints the public URLs (`/ko/posts/cms-elements`, `/ko/memos/showcase-memo`) and the admin edit URLs (`/studio/entries/<id>/edit`).
It does not start the dev server. If port 3997 is busy, start the server on another port and pass `--port <n>` to get URLs for it. Media files need storage that is not set up here, so the sample has an image from `public/showcase/` and no file attachment. The AI screen (`/studio/ai`) renders without an API key; running an action needs a connection saved on the AI screen.

Checklist, on the public page (`/ko/posts/cms-elements`):

- [ ] Every element renders: headings h2 to h4, bold, italic, strikethrough, inline code, underline, superscript and subscript, links, hard break, nested ordered, unordered and task lists, quote, rule, table with alignment, code blocks (title, highlight, focus, added and removed lines, warning, error, note, fold), math, image and footnote.
- [ ] Every block renders: the five callouts, both collapsibles, tabs, columns, Mermaid, chart, tooltip, text color, code explorer and the code link (hover the text and the lines of the code block light up).
- [ ] Nothing shows twice (no repeated block, footnote or caption).
- [ ] No fallback boxes, raw MDX or error text in place of an element.
- [ ] Dark mode is readable: toggle the system theme and check text, table borders, code lines, callouts and the chart.
- [ ] The links between the two posts and to the memo work, and the second post links back.
- [ ] The unpublished draft returns 404 on the public site.

Checklist, in the admin editor (`/studio/entries/<id>/edit`):

- [ ] The editor opens every block of the post, and no block shows as raw or unparsed text. The source panel shows the directive notation.
- [ ] Editing a block (a list item, a code block annotation, the chart, a callout) and saving works, and the published page matches after publishing.
- [ ] Dark mode is readable in the editor too.

Do not commit the `AGENTS.md` and `CLAUDE.md` that `next dev` creates in this folder.
