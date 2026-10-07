# Monti

English | [한국어](README.ko.md)

A CMS for developer blogs.

The name is short for Montaigne. In Italian, "monti" also means "mountains".

## Quick start: add Monti to an existing Next app

Run this in the folder of a Next.js (App Router) app:

```sh
npx monti init
```

It looks at the app (App Router, `src/` or not, package manager, TypeScript, Tailwind, existing `content/` folders of Markdown or MDX), asks a few questions, and then writes explicit files you can read and change: `monti.config.ts` (one line per feature, each with a comment), `monti.schema.json` (a starter `post` collection, shaped by your front matter if it finds content), the three Next files (`app/studio/layout.tsx`, `app/studio/[[...path]]/page.tsx`, `app/api/cms/[...path]/route.ts`), `.env.example` and `.env.local` (only a generated `MONTI_SECRET` and the values you typed). It installs the packages, wraps `next.config.ts` with `withCms` (showing the diff), runs `monti migrate` when the database is reachable, and ends with a plain list of what is left, with exact values, and a pointer to `npx monti doctor` for whenever something does not work.

- **Questions:** the database (a URL, a local Docker Postgres, or later), the GitHub login, languages, image storage (S3, R2, MinIO or none), extras (AI writing, git sync), which body blocks, the admin path (default `/studio`), and whether to install the blog theme pages.
- **No prompts:** every question has a flag, and `--yes` takes the defaults. `--json` prints the result for CI and AI tools, `--dry-run` shows what would happen. See `monti init --help`, or "`monti init`" in the [core README](packages/core/README.md).
- **Safe:** it never overwrites a file without asking, never writes outside the project, and says what it wrote if a run stops partway.
- **Existing posts:** if it finds Markdown or MDX folders, it ends by suggesting `npx monti import <folder>`.

Until the public release, `@monti-cms/core` is installed from the release bundle first (see "Install"); `npx monti init` then installs the rest.

## Troubleshooting: run `monti doctor`

If something does not work, run this in the folder of the app:

```sh
npx monti doctor
```

It checks the whole setup and prints each check as `ok`, `warn` or `FAIL`. Every warning and failure says what is wrong, where (a file or an environment variable) and how to fix it: the config file and the schema file, `DATABASE_URL` and whether the database is reachable and migrated (how many migrations are pending, and `monti migrate`), `MONTI_SECRET`, the GitHub login (the callback URL to register, the admin id, `SITE_URL`), the three Next files, what is left of the old two-file setup (with the exact rename steps), and the checks each plugin adds (git-sync token and webhook, the S3 values, an AI connection, MDX syntax extensions). `--online` also checks the git-sync repo and the S3 bucket, `--json` prints the result for tools, and the exit code is 1 when a check fails. The errors the packages throw say the same things in the same way. See "Troubleshooting: `monti doctor`" in the [core README](packages/core/README.md).

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

## Development

```sh
pnpm install          # install
pnpm lint             # lint (fix with pnpm lint:fix)
pnpm check:korean     # check that Korean strings in runtime code live only in the message dictionaries
pnpm typecheck        # type check all packages
pnpm build            # build all packages (core → auth → storage-s3 → mdx → syntax-directive → syntax-shiki → admin → nextjs → ai → blocks → bareun → seo → git-sync)
pnpm test:run         # tests (needs Postgres)
pnpm example:check    # pack the packages, install them into the example app and build it
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
