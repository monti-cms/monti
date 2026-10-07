# Example app: blog

English | [한국어](README.ko.md)

A personal tech blog on `@monti-cms/core`, modelled on the maintainer's own blog: collections Post, Memo, Category, Tag and Series (the `collection` collection), in Korean (the default) and English. It attaches everything
the blog uses: every body block (`@monti-cms/blocks`: callout, collapsible, tabs, columns, Mermaid, chart, tooltip, code link, text color, code explorer), the SEO fields (`@monti-cms/seo`, through `seoFields`), the AI plugin (`@monti-cms/ai`),
the Bareun spell checker (`@monti-cms/bareun`) and MDX written in the directive notation (`mdx({ syntax: [directiveSyntax()] })` of `@monti-cms/mdx` and `@monti-cms/syntax-directive`, write mode on, so a post body reads `:::callout{…}`).
Packages are installed from **built bundles** (`vendor/*.tgz`), not from the repository sources.

```sh
# From the repo root: build the packages and pack them into vendor/
pnpm example:pack

# In this folder
pnpm install --ignore-workspace
cp .env.example .env.local   # fill in CMS_DATABASE_URL and the rest
pnpm db:migrate               # = monti migrate
pnpm dev                     # http://localhost:3000/studio
```

pnpm 12 stops the install unless the esbuild install script is allowed. Copy this folder out of the repo, put `allowBuilds: { esbuild: true }` in `pnpm-workspace.yaml`, and install with `pnpm install` (with `--ignore-workspace` that setting is not read). pnpm 10, which the repo uses, only warns.

With `CMS_DEV_AUTH_BYPASS=1`, `next dev` opens the admin screen without logging in for requests from your own machine (`localhost`). The bypass is refused on a server that looks deployed. Deploying behind a proxy or on Vercel needs `AUTH_TRUST_HOST=true` for login (core README, "Host trust").

## Files

The shape is what `monti init --admin-path /studio` generates, plus this site's collections and extensions.

| File | Contents |
| --- | --- |
| `cms.config.ts` | Collections (`post`, `memo`, `category`, `tag`, `collection`), the record fields, the SEO fields, the seed templates and the plugins (`mdx` with the directive notation, `blocks()`, `seo()`, `aiPlugin()`, `bareun()`). Admin path `admin.path: "/studio"`, URL rule `site.localePrefix: "always"` (`/ko/posts/…`, `/en/posts/…`), and the preview language comes from the path (`previewLocaleParam: false`) |
| `cms.server.ts` | The CMS instance: `createCms` over the DB and GitHub login server config (as `monti init` generates; `githubAuth` comes from `@monti-cms/nextjs/auth`). The admin, the API route and the site pages (`cms.read.*`) all import `cms` from it |
| `app/(admin)/studio/` | The admin screen (`[[...path]]/page.tsx` and `layout.tsx`, using `@monti-cms/nextjs/admin`; the layout imports the prebuilt `@monti-cms/admin/styles.css` and `@monti-cms/blocks/styles.css`) and an example spell-check extension (`admin-components.tsx`) |
| `components/monti/blog-theme/` and `app/(site)/[locale]/posts/` | The post list and post pages, installed as source with `pnpm exec monti add blog-theme --registry ../../registry/r` (from this folder). The command writes the route files to `app/(site)/blog/`; here they were moved to `app/(site)/[locale]/posts/` (the site uses `/ko/...` URLs), and the pages read `params.locale` from there. `components/monti/blog-theme/theme.config.ts` is the one file edited after the install: the collection (`post`), `routeBase` (`/posts`), the tag relation (`tagIds`) and the summary field (`summary`). The blocks need no `components`: the plugins bring their public components. Running the command again would write the route files to `app/(site)/blog/` once more, so delete that copy |
| `app/(site)/[locale]/memos/` | The memo list and memo page. The theme reads one collection, so these two small pages are written by hand with the same `cms.read` API and `ArticleBody` |
| `components/monti/article-body/` | The article body, installed as source with `pnpm exec monti add article-body --registry ../../registry/r` (from this folder; `blog-theme` brings it too) and used by the article page. Edit it freely; `monti add` refuses to overwrite a changed file without `--overwrite` ("Components as source" in the core README). `tsconfig.json` has the `@/*` alias it is imported through |
| `showcase/` | The sample content (`*.mdx`) and `seed.ts`, which `pnpm preview:example` runs to put it into the preview database: the "CMS elements" post (every element and every block, in directive notation), a second post that links back, a memo, a category, tags, a series and one unpublished draft |
| `app/api/cms/[...path]/route.ts` | Admin API and login (`/api/cms/auth/*`), served by `createRouteHandler(cms)` of `@monti-cms/nextjs`. There is no separate login route file |
| `app/globals.css` | The public site's own styles: Tailwind with typography, and the public page styles of the packages (`@monti-cms/core/render.css`, `@monti-cms/blocks/render.css`). It has no admin lines: the admin styles are prebuilt and scoped to the admin, so the site needs no Tailwind setup for them |

To use GitHub login, set the OAuth app's callback URL to `http://localhost:3000/api/cms/auth/callback/github`.

## What differs from the maintainer's blog

The config keeps the collections, field kinds, layouts, SEO fields, plugins and seed templates of the maintainer's blog, with English labels (config labels are site content, and this repo has no dictionary for them). Left out:

- the blog's own plugin `legacyListColumns()` and `admin.legacyBackupNames`, which only migrate that site's old saved admin settings and old browser recovery copies;
- the locale list and names come from the config itself instead of the blog's `i18n` module, and `site.url` is read from `HOST_URL` as the blog does;
- the AI style guide is written in English, since this repo keeps config text in English.

## Trying it inside the repo

This does not use the production DB. It creates a `cms_preview_*` schema in the test DB (`CMS_TEST_DATABASE_URL`) and drops it when finished.

```sh
export CMS_DATABASE_URL="$CMS_TEST_DATABASE_URL" CMS_SCHEMA=cms_preview_example CMS_DEV_AUTH_BYPASS=1 AUTH_SECRET=local-only
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
It does not start the dev server. If port 3997 is busy, start the server on another port and pass `--port <n>` to get URLs for it. Media files need storage that is not set up here, so the sample has an image from `public/showcase/` and no file attachment. The AI screen (`/studio/ai`) and the spell check button render without an API key; running them needs a connection and `BAREUN_API_KEY`.

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
