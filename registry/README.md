# Component registry

English | [한국어](README.ko.md)

Components you install as **source**: `monti add <name>` copies the files into your app, and from then on they are yours to read and change. They are not
a library to import. They sit only on public entry points: `@monti-cms/admin/hooks` (editor hooks, experimental), `@monti-cms/core/render`,
`@monti-cms/core/client`, `@monti-cms/core/read` (types) and `@monti-cms/nextjs`, and they draw with plain elements and the host app's own Tailwind classes. (The admin screen's own styles are separate: it ships prebuilt.)

```sh
pnpm exec monti add article-body                 # one component
pnpm exec monti add entry-editor notice-block-view
pnpm exec monti add blog-theme                   # a post list and a post page, see "Blog theme"
pnpm exec monti add article-body --dry-run       # show what would be written and installed
```

## Components

| Name | Type | What it is | Needs |
| --- | --- | --- | --- |
| `article-body` | public page | `<ArticleBody cms={cms} entry={entry} components={...} />`: the stored document drawn by `CmsContent`, with a table of contents from `tableOfContents` above it. A server component | `@monti-cms/core` |
| `blog-theme` | public pages | A post list (paged) and a post page (title, date, author, table of contents, body, newer and older post) for one collection, with `generateMetadata`, 404 and redirects. Route files go to `app/(site)/blog/`, and a draft preview page to `app/(site)/preview/blog/` (for `site.previewPath: "/preview"`, read with `previewEntry` of `@monti-cms/nextjs`) | `@monti-cms/core`, `@monti-cms/nextjs`, `next`, `article-body` |
| `entry-editor` | admin | `<EntryEditorScreen adminId target fields />`: a minimal custom editor screen on `useEntryEditor` (load, save, publish, recovery copy, conflict) and `useField` | `@monti-cms/admin`, `field-row` |
| `field-row` | admin | `<FieldRow name="title" />`: one form field on `useField` (label, control, description, error) | `@monti-cms/admin` |
| `notice-block-view` | admin | The edit view of a `notice` block for `blockViews`: an editable title, a level switch and the nested body (`useBlockEditor`, `BlockFrame`, `Content`). Export `noticeBlockViews` | `@monti-cms/admin` |

## Blog theme

`monti add blog-theme` gives a collection a working blog: a list page and a post page, as source you edit. It reads posts with `cms.read` (`listEntries`, `getEntry`), draws the body with the `article-body`
item (it comes along as a `registryDependency`), and uses only the host's Tailwind classes, including `dark:` for dark mode and `prose` from `@tailwindcss/typography`. It never imports `@monti-cms/admin*`
or any admin stylesheet (a test checks this), so a public page loads no admin CSS.

```sh
pnpm exec monti add blog-theme
# components/monti/blog-theme/{theme.config.ts, blog-list.tsx, blog-post.tsx, post-meta.tsx, pagination.tsx}
# app/(site)/blog/page.tsx          the list:   /blog?page=2
# app/(site)/blog/[slug]/page.tsx   the post:   /blog/<slug>
```

- **Edit `theme.config.ts`.** It is the one place for what differs per site: the `cms` import (`@/monti.config`), the `collection` name (default `post`), `routeBase` (`/blog`), `pageSize`, the relation
  fields for the author and topics, the summary field, `blogTitle`, `components` (the public components of your blocks, as for `CmsContent`) and `neighborWindow` (how many of the newest posts are searched for the
  newer and older post; `0` turns those links off).
- **The route.** The route files are thin: they re-export the page and `generateMetadata` from `blog-list.tsx` and `blog-post.tsx`. The pages read the database on each request, so they wait for the request (`connection()` from `next/server`) inside a `Suspense` boundary instead of exporting `dynamic = "force-dynamic"`, which Next rejects under `cacheComponents`; this works with and without that option (a missing post still ends in `notFound()`, but a streamed page cannot always change the HTTP status). To serve the blog under another path, move
  the two folders and set `routeBase` to match. Under a `[locale]` folder (`app/(site)/[locale]/blog/`) the pages read `params.locale` and show 404 for an unknown language; without it they read the default language.
  The theme styles its text with the `prose` classes and the public styles of the packages, so `monti add blog-theme` also checks your global CSS: it needs `@tailwindcss/typography` (`@plugin "@tailwindcss/typography";`), `@import "@monti-cms/core/render.css";` and, if you use blocks, `@import "@monti-cms/blocks/render.css";`. It shows the change as a diff and asks before editing the file (`--yes` skips the question); declined, or on a stylesheet it cannot edit (Tailwind 3), it prints the exact lines.
  Running `monti add blog-theme` again writes the route files to `app/(site)/blog/` once more; if you moved them, delete the new copies.
- **Not found and redirects.** An unknown, unpublished or draft address is a 404, and an old address of a renamed post is a permanent redirect to the new one.
- **Metadata.** The post page sets the title, the description (the summary field), a canonical path and Open Graph article fields.

`notice-block-view` draws a block your config defines: add a `notice` block with a container syntax and a `level` attribute (`info` or `warning`) to the schema or blocks of `monti.config.ts`,
then register the view through the `CmsAdminComponentsProvider` of your own admin plugin (`definePlugin({ ..., admin: () => import("./admin") })` with `defineAdminPlugin({ Provider })`):

```tsx
import { noticeBlockViews } from "@/components/monti/notice-block-view/notice-block-view";

const components: CmsAdminComponents = { blockViews: { ...noticeBlockViews } };
```

## What `monti add` does

- **Where files go.** Under the components alias of the host, in `monti/<name>/`. The alias is `aliases.components` of `components.json` (shadcn's file) if there is one,
  else `@/components`, and its folder comes from the `paths` of `tsconfig.json` (else `src/` when the app has one, else the app folder; the command then tells you which `paths` line to add).
  So the default is `components/monti/<name>/…` (or `src/components/monti/<name>/…`). A file with a `target` goes to that path, relative to the app folder. `{app}` in a target is the App Router folder: `src/app` when the app has `src/app` (or `src/` and no `app/`), else `app`. Any other `{name}` is an error.
- **Imports.** Components import each other through the registry's own prefix, `@/registry/monti/<name>/<file>`. It is rewritten to the host alias when the file is copied
  (`@/components/monti/<name>/<file>`). Relative imports and package imports are left alone.
- **Needed components.** `registryDependencies` are installed first and once: `entry-editor` brings `field-row`, and `blog-theme` brings `article-body`. An entry can be a name in the same registry or the URL of an item.
- **npm packages.** The `dependencies` and `devDependencies` of the items that the app does not list yet are installed with its package manager (found from the lockfile, then the `packageManager` field, else npm).
- **Your edits are safe.** Every file is compared first. A file that holds exactly the registry's content is left alone (so running it twice does nothing). A file that differs
  stops the whole install: nothing is written, no package is installed, and the files are listed. `--overwrite` replaces them; compare with `git diff` afterwards.
- **`--dry-run`** reports the same plan and changes nothing.
- **`--registry <url|path>`** reads another registry: a folder (or its `registry.json`) or a URL that serves `registry.json` and `<name>.json`. Without it the command uses the
  `registry/r` folder of a checkout of this repo, and otherwise `https://raw.githubusercontent.com/monti-cms/monti/overhaul/registry/r`.

## shadcn compatibility

The files follow the [shadcn registry schema](https://ui.shadcn.com/docs/registry): `registry.json` lists the items, and `<name>.json` is a registry item
(`name`, `type`, `files[]` with `path`, `type`, `target` and `content`, `dependencies`, `registryDependencies`). A built registry is static files and can be hosted anywhere.
`npx shadcn add <url>/article-body.json` reads the same files and works for items that import no other item (`article-body`, `notice-block-view`). It places files by item type and does not
know the `@/registry/monti/` prefix or `{app}`, so use `monti add` for an item with `registryDependencies` such as `entry-editor` and `blog-theme`. To give shadcn full URLs for those, build with
`node scripts/build-registry.mjs --base-url <url>`.

## Layout and build

```
registry/
  registry.json            source manifest: items, their files by path, dependencies
  items/<name>/<file>      the source of each component (TypeScript, type checked here)
  r/                       built output, committed: registry.json and <name>.json with the file contents
```

`registry/` is a private workspace package (`@monti-cms/registry`) only so the sources are type checked against the real packages (`pnpm typecheck`) and linted. It is not published.

```sh
pnpm registry:build   # write registry/r from registry.json and the sources
pnpm registry:check   # fail if registry/r is not what the sources build
```

The output is **committed**, so the default registry works from a checkout and a change to a component shows up in review as the item JSON it ships. A core test runs the check, so a
forgotten rebuild fails CI. After editing a component or `registry.json`, run `pnpm registry:build` and commit `registry/r`.

## Adding a component

1. Put the files in `registry/items/<name>/` (kebab-case names). Import other items as `@/registry/monti/<other>/<file>`, and packages only from public entry points.
2. List the item in `registry.json`: `name`, `type`, `description`, the npm `dependencies` (a `name` or `name@range`), `registryDependencies` and `files`.
3. `pnpm registry:build`, then `pnpm typecheck` and `pnpm test:run`.
