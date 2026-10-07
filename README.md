# Monti

English | [한국어](README.ko.md)

A CMS for developer blogs.

The name is short for Montaigne. In Italian, "monti" also means "mountains".

## Packages

| Package | What it does |
| --- | --- |
| [`@monti-cms/core`](packages/core) | The core. Config, entry storage and publishing, the document model, admin API, command line (`monti`) |
| [`@monti-cms/mdx`](packages/mdx) | MDX extension. The `mdx` format, the admin source panel, `renderMdx` and the syntax extension API |
| [`@monti-cms/admin`](packages/admin) | The admin UI. Editor, entry list, media, templates. Framework-neutral: it reaches the router through an adapter |
| [`@monti-cms/auth`](packages/auth) | Admin login on `Request` and `Response` (Auth.js core), with pluggable providers. GitHub ships with it |
| [`@monti-cms/nextjs`](packages/nextjs) | The Next.js adapter. Route handler, `next.config.ts` wiring, admin page and layout with the App Router adapter, the Next side of the login |
| [`@monti-cms/blocks`](packages/blocks) | Block extension. Callout, toggle, tabs, columns, code explorer, Mermaid, chart |
| [`@monti-cms/ai`](packages/ai) | AI extension. AI features such as writing and translation |
| [`@monti-cms/seo`](packages/seo) | SEO extension. Search and sharing fields with a preview |
| [`@monti-cms/bareun`](packages/bareun) | Bareun spell checking |
| [`@monti-cms/storage-s3`](packages/storage-s3) | Media storage on the S3 API (AWS S3, Cloudflare R2, MinIO), configured from `S3_*` / `R2_*` environment variables |
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

`@monti-cms/mdx` is needed for MDX (the `mdx` format, the source panel, syntax extensions) and by the AI extension; install it the same way. Installation and setup are described in each package's README. The example app with everything attached is [`examples/blog`](examples/blog).

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
