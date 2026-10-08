# Monti

English | [한국어](README.ko.md)

A CMS for developer blogs.

The name is short for Montaigne. In Italian, "monti" also means "mountains".

## Quick start: add Monti to an existing Next app

Run this in the folder of a Next.js (App Router) app:

```sh
# Until the public release, install @monti-cms/core from the release bundle first (see "Install")
# pnpm
pnpm add @monti-cms/core
pnpm exec monti init

# npm
npm install @monti-cms/core
npx monti init

# yarn
yarn add @monti-cms/core
yarn monti init

# bun
bun add @monti-cms/core
bunx monti init
```

It looks at the app (App Router, `src/` or not, package manager, TypeScript, Tailwind, existing `content/` folders of Markdown or MDX), asks a few questions, and then writes explicit files you can read and change: `monti.config.ts` (one line per feature, each with a comment), `monti.schema.json` (a starter `post` collection, shaped by your front matter if it finds content), the three Next files (`app/studio/layout.tsx`, `app/studio/[[...path]]/page.tsx`, `app/api/cms/[...path]/route.ts`), `.env.example` and `.env.local` (only a generated `MONTI_SECRET` and the values you typed). It installs the packages, wraps `next.config.ts` with `withCms` (showing the diff), runs `monti migrate` when the database is reachable, and ends with a plain list of what is left, with exact values, and a pointer to `monti doctor` for whenever something does not work.

- **Questions:** the database (a URL, a local Docker Postgres, or later), the GitHub login, languages, image storage (S3, R2, MinIO or none), extras (AI writing, git sync), which body blocks, the admin path (default `/studio`), and whether to install the blog theme pages.
- **No prompts:** every question has a flag, and `--yes` takes the defaults. `--json` prints the result for CI and AI tools, `--dry-run` shows what would happen. See `monti init --help`, or "`monti init`" in the [core README](packages/core/README.md).
- **Safe:** it never overwrites a file without asking, never writes outside the project, and says what it wrote if a run stops partway. When a step fails (the install, the theme, the typography plugin, the tables) it does not say "Monti is added": it lists the failed steps and the exact commands that finish the job, in order, and `monti init --resume` runs only the steps that did not complete.
- **pnpm 12:** it stops an install until esbuild's install script is allowed. Put `allowBuilds:` with `esbuild: true` in `pnpm-workspace.yaml` (never a second key); `monti init` checks it and fixes it with a diff and a confirmation.
- **Languages:** file names like `hello.ko.mdx` + `hello.en.mdx` (or `ko/` and `en/` folders) give the site languages; under `--yes` they are used, the default being the language whose files have no pair.
- **Existing posts:** if it finds Markdown or MDX folders, it ends by suggesting `monti import <folder>`. Its default body blocks are a light set; `mermaid` and `chart` are opt-in (`--blocks all`): they come from `@monti-cms/blocks/mermaid` and `@monti-cms/blocks/chart` and bring `mermaid` and `recharts` only when chosen, so an app without them loads and installs neither.

Until the public release, `@monti-cms/core` is installed from the release bundle first (see "Install"); `monti init` then installs the rest. Always install `@monti-cms/core` before running `monti`: `npx monti` without it fetches an unrelated package. The short version with every command is the [Quick start](packages/core/README.md#quick-start-existing-next-app) of the core README.

## Troubleshooting: run `monti doctor`

If something does not work, run this in the folder of the app:

```sh
pnpm exec monti doctor
```

It checks the whole setup and prints each check as `ok`, `warn` or `FAIL`. Every warning and failure says what is wrong, where (a file or an environment variable) and how to fix it: the config file and the schema file, `DATABASE_URL` and whether the database is reachable and migrated (how many migrations are pending, and `monti migrate`), `MONTI_SECRET`, the GitHub login (the callback URL to register, the admin id, `SITE_URL`), the three Next files, what is left of the old two-file setup (with the exact rename steps), and the checks each plugin adds (git-sync token and webhook, the S3 values, an AI connection, MDX syntax extensions). `--online` also checks the git-sync repo and the S3 bucket, `--json` prints the result for tools, and the exit code is 1 when a check fails. The errors the packages throw say the same things in the same way. See "Troubleshooting: `monti doctor`" in the [core README](packages/core/README.md).

## Editing the admin itself

Most sites change the admin by adding to it: a field type, a block, a plugin screen (see "Plugins" in the [core README](packages/core/README.md)). When that is not enough there are two ways to take the admin into your own hands. Which one fits depends on how much of it you want to keep.

The principle is the same for both: Monti opens what you touch (the screens, the editor, the blocks) and seals what core guards (storage, migrations and the write pipeline). Your own admin still saves through core, so those keep receiving upgrades.

### Path 1: build your own admin from the hooks

`@monti-cms/admin/hooks` (experimental) gives you the editor as state and commands without any UI: `useEntryEditor` (load, recovery copy, save, publish, status changes, conflicts), `useField` (one form field), `useBlockEditor` with `Content` and `BlockFrame` (the view of a block) and `blockViews` (registering block views). Hooks never show a toast, open a dialog or navigate, so you draw all of it. The default admin is built on the same hooks. Registry items installed with `monti add` (for example `entry-editor` and `article-body`) are examples you own and can start from.

```tsx
"use client";
import { EntryEditorProvider, useEntryEditor, useField } from "@monti-cms/admin/hooks";

function TitleInput() {
	const title = useField("title");
	return <input {...title.inputProps} value={String(title.value ?? "")} onChange={(event) => title.setValue(event.target.value)} />;
}

export function MyEntryEditor({ adminId, entryId }: { adminId: string; entryId: string }) {
	const editor = useEntryEditor({ adminId, target: { mode: "edit", entryId } });
	if (editor.load.status !== "ready") return null;
	return (
		<EntryEditorProvider editor={editor}>
			<TitleInput />
			<button type="button" onClick={() => void editor.save()}>
				Save
			</button>
		</EntryEditorProvider>
	);
}
```

Choose this path when you want a different admin: another layout, another editing flow, or only one screen of your own. Nothing is copied, so the rest of the admin keeps updating. The reference is the [admin README](packages/admin/README.md#editor-hooks-experimental).

### Path 2: `monti eject` to edit the shipped admin

```sh
pnpm exec monti eject @monti-cms/admin --dry-run   # what would be written; nothing is changed
pnpm exec monti eject @monti-cms/admin             # asks first; --yes skips the question
```

`monti eject <package>` copies the source of a UI package, from the version you have installed, into your repo and makes the app use the copy. You then edit it like your own code, and a change shows on the next reload.

- **What can be ejected:** the UI packages `@monti-cms/admin`, `@monti-cms/blocks`, `@monti-cms/seo` and `@monti-cms/ai`. `seo` and `ai` are taken whole, because their admin and server parts are one package. Core, auth, mdx, nextjs, the storage packages and the other data packages are refused with the reason, because storage, migrations and the write pipeline must keep receiving upgrades. The list is in one file, `packages/core/src/cli/eject/allowlist.ts`.
- **Where it goes:** `packages/monti-admin/` (`monti-blocks`, `monti-seo`, `monti-ai`), a workspace package. A workspace package is the one shape every package manager links live and installs the dependencies of, and `packages/` is under version control with the rest of your site. The package keeps its name, so no import changes, and the other Monti packages that need `@monti-cms/admin` use your copy.
- **What changes in your app:** the dependency in `package.json` becomes `workspace:*` (`*` for npm and yarn classic), the folder is added to `pnpm-workspace.yaml` or to the `workspaces` field, an override that pins the package is pointed at the copy, `.monti/ejected.json` records `{ package, version, ejectedAt, directory }` (and `.gitignore` is changed so that the record is committed), and the package manager's install runs. `withCms` builds the ejected packages with the app. The stylesheet is the prebuilt one, copied to `prebuilt/styles.css`; a new Tailwind class you use in the ejected source is not in it, so put its rule in your own CSS.
- **Updates are your job from now on.** `pnpm up` no longer changes the package. `monti doctor` lists the ejected packages and warns when one was ejected from a version older than the `@monti-cms/core` you run. To see what changed upstream since your version, run `monti eject --diff @monti-cms/admin` (add `--to <version|folder|tgz>` to compare with something other than the latest); it marks the files you edited as well, so you know where to merge by hand.
- **Flags:** `--dry-run`, `--yes`, `--json`, `--no-install`. Without a terminal and without `--yes` nothing is changed.

Choose this path when you like the admin and want to change a part of it. If you want to rebuild how the whole editor works, the hooks are the lighter path. Forking the whole monorepo is not something `monti` does for you.

## Packages

| Package | What it does |
| --- | --- |
| [`@monti-cms/core`](packages/core) | The core. One config (`monti.config.ts`), entry storage and publishing, the document model, admin API, command line (`monti`) |
| [`@monti-cms/mdx`](packages/mdx) | MDX extension. The `mdx` format, the admin source panel, `renderMdx` and the syntax extension API |
| [`@monti-cms/admin`](packages/admin) | The admin UI. Editor, entry list, media, templates. Framework-neutral: it reaches the router through an adapter |
| [`@monti-cms/auth`](packages/auth) | Admin login on `Request` and `Response` (Auth.js core), with pluggable providers. GitHub ships with it |
| [`@monti-cms/nextjs`](packages/nextjs) | The Next.js adapter. Route handler, `next.config.ts` wiring, admin page and layout with the App Router adapter, the Next side of the login |
| [`@monti-cms/blocks`](packages/blocks) | Block extension. Callout, toggle, tabs, columns, code explorer, Mermaid, chart |
| [`@monti-cms/ai`](packages/ai) | AI extension. AI features such as writing and translation |
| [`@monti-cms/seo`](packages/seo) | SEO extension. Search and sharing fields with a preview |
| [`@monti-cms/bareun`](packages/bareun) | Bareun spell checking |
| [`@monti-cms/storage-s3`](packages/storage-s3) | Media storage on the S3 API (AWS S3, Cloudflare R2, MinIO), one `s3Storage()` configured from `S3_*` environment variables |
| [`@monti-cms/git-sync`](packages/git-sync) | Git sync extension. Two-way sync of published entries with files in a GitHub repo, with a conflict screen |
| [`@monti-cms/syntax-directive`](packages/syntax-directive) | Directive syntax extension. Reads and writes `:::callout`, `::image{…}` and `:u[text]` |
| [`@monti-cms/syntax-shiki`](packages/syntax-shiki) | Shiki code notation extension. Reads `// [!code ++]` and friends in code fences as Monti code annotations |

## Supported frameworks

Next.js (App Router) is the only supported host for now. Only `@monti-cms/nextjs` imports from Next.js: the core speaks the standard `Request` and `Response`, and the admin reaches the router through a small adapter it is given. Another framework would be a new adapter package, not a change to the core or the admin. See the core README, "Supported frameworks".

## Install

Not on npm yet. Until the public release, install the release bundle from the `release` branch by GitHub address (pnpm only).

```json
{
	"dependencies": {
		"@monti-cms/core": "github:monti-cms/monti#release/v0.1.0&path:/core",
		"@monti-cms/admin": "github:monti-cms/monti#release/v0.1.0&path:/admin",
		"@monti-cms/nextjs": "github:monti-cms/monti#release/v0.1.0&path:/nextjs"
	}
}
```

For the other packages, change only `path:/<folder name>` and use the same tag.

`@monti-cms/mdx` is needed for MDX (the `mdx` format, the source panel, syntax extensions) and by the AI extension; install it the same way. Installation and setup are described in each package's README. The example app with everything attached is [`examples/blog`](examples/blog); its one config file is `monti.config.ts`, which exports the ready `cms` instance.

## Recipes

Small, working, tested examples of how to extend Monti, each written from the docs alone: a Slack message on publish, your own block (definition, editor view, public component, check), a custom admin field screen, a slug rule before save, a custom format, typed reads on the public site, an admin page of a plugin, and a `monti doctor` check from a plugin. Start at [`docs/recipes`](docs/recipes/README.md); the code is in [`examples/recipes`](examples/recipes) and every recipe has a test that runs it end to end.

## Development

```sh
pnpm install          # install
pnpm lint             # lint (fix with pnpm lint:fix)
pnpm check:korean     # check that Korean strings in runtime code live only in the message dictionaries
pnpm typecheck        # type check all packages
pnpm build            # build all packages (core → auth → storage-s3 → mdx → syntax-directive → syntax-shiki → admin → nextjs → ai → blocks → bareun → seo → git-sync)
pnpm test:run         # tests (needs Postgres)
pnpm example:check    # pack the packages, install them into the example app and build it
pnpm recipes:check    # check that the code shown in docs/recipes is the code of examples/recipes (pnpm recipes:docs updates the pages)
```

On commit, the code check (lint-staged) and the commit message check (commitlint) run automatically. Write commit messages in English as `type(scope): subject` (for example `feat(core): add thing`). Pick the scope from `core`, `storage-s3`, `admin`, `nextjs`, `ai`, `blocks`, `mdx`, `seo`, `bareun`, `git-sync`, `syntax`, `example`, `scripts`, `ci`, `deps`, `release`, `repo`, or leave it out. On push, lint, check:korean and typecheck run.

All tests run only if `.env.local` has a test DB URL (`CMS_TEST_DATABASE_URL`). The tests create a temporary schema in this DB and drop it when finished.

## Releasing

```sh
node scripts/version.mjs 0.1.0   # change every package version at once
git commit -am "chore(release): v0.1.0"
git tag v0.1.0 && git push origin main v0.1.0
```

When a `v*` tag is pushed, the release workflow (`.github/workflows/release.yml`) builds and packs the packages, commits them to the `release` branch and adds a `release/v0.1.0` tag.

## License

[MIT](LICENSE)
