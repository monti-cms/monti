# Component registry

English | [한국어](README.ko.md)

Components you install as **source**: `monti add <name>` copies the files into your app, and from then on they are yours to read and change. They are not
a library to import. They sit only on public entry points: `@monti-cms/admin/hooks` (editor hooks, experimental), `@monti-cms/core/render`,
`@monti-cms/core/client` and `@monti-cms/nextjs`, and they draw with plain elements and the host app's own Tailwind classes. (The admin screen's own styles are separate: it ships prebuilt.)

```sh
pnpm exec monti add article-body                 # one component
pnpm exec monti add entry-editor notice-block-view
pnpm exec monti add article-body --dry-run       # show what would be written and installed
```

## Components

| Name | Type | What it is | Needs |
| --- | --- | --- | --- |
| `article-body` | public page | `<ArticleBody entry={entry} components={...} />`: the stored document drawn by `CmsContent`, with a table of contents from `tableOfContents` above it. A server component | `@monti-cms/core` |
| `entry-editor` | admin | `<EntryEditorScreen adminId target fields />`: a minimal custom editor screen on `useEntryEditor` (load, save, publish, recovery copy, conflict) and `useField` | `@monti-cms/admin`, `field-row` |
| `field-row` | admin | `<FieldRow name="title" />`: one form field on `useField` (label, control, description, error) | `@monti-cms/admin` |
| `notice-block-view` | admin | The edit view of a `notice` block for `blockViews`: an editable title, a level switch and the nested body (`useBlockEditor`, `BlockFrame`, `Content`). Export `noticeBlockViews` | `@monti-cms/admin` |

`notice-block-view` draws a block your config defines: add a `notice` block with a container syntax and a `level` attribute (`info` or `warning`) to `cms.config.ts`,
then register the view in your admin components:

```tsx
import { noticeBlockViews } from "@/components/monti/notice-block-view/notice-block-view";

const components: CmsAdminComponents = { blockViews: { ...noticeBlockViews } };
```

## What `monti add` does

- **Where files go.** Under the components alias of the host, in `monti/<name>/`. The alias is `aliases.components` of `components.json` (shadcn's file) if there is one,
  else `@/components`, and its folder comes from the `paths` of `tsconfig.json` (else `src/` when the app has one, else the app folder; the command then tells you which `paths` line to add).
  So the default is `components/monti/<name>/…` (or `src/components/monti/<name>/…`). A file with a `target` goes to that path, relative to the app folder.
- **Imports.** Components import each other through the registry's own prefix, `@/registry/monti/<name>/<file>`. It is rewritten to the host alias when the file is copied
  (`@/components/monti/<name>/<file>`). Relative imports and package imports are left alone.
- **Needed components.** `registryDependencies` are installed first and once: `entry-editor` brings `field-row`. An entry can be a name in the same registry or the URL of an item.
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
know the `@/registry/monti/` prefix, so use `monti add` for an item with `registryDependencies` such as `entry-editor`. To give shadcn full URLs for those, build with
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
