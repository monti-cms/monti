# Monti

English | [한국어](README.ko.md)

A CMS for developer blogs.

The name is short for Montaigne. In Italian, "monti" also means "mountains".

## Packages

| Package | What it does |
| --- | --- |
| [`@monti-cms/core`](packages/core) | The core. Config, entry storage and publishing, MDX conversion, admin API, command line (`monti`) |
| [`@monti-cms/admin`](packages/admin) | The admin UI. Editor, entry list, media, templates |
| [`@monti-cms/blocks`](packages/blocks) | Block extension. Callout, toggle, tabs, columns, Mermaid, chart |
| [`@monti-cms/ai`](packages/ai) | AI extension. AI features such as writing and translation |
| [`@monti-cms/seo`](packages/seo) | SEO extension. Search and sharing fields with a preview |
| [`@monti-cms/bareun`](packages/bareun) | Bareun spell checking |
| [`@monti-cms/syntax-directive`](packages/syntax-directive) | Directive syntax extension. Reads and writes `:::callout`, `::image{…}` and `:u[text]` |

## Install

Not on npm yet. Until the public release, install the release bundle from the `release` branch by GitHub address (pnpm only).

```json
{
	"dependencies": {
		"@monti-cms/core": "github:monti-cms/monti#release/v0.1.0&path:/core",
		"@monti-cms/admin": "github:monti-cms/monti#release/v0.1.0&path:/admin"
	}
}
```

For the other packages, change only `path:/<folder name>` and use the same tag.

Installation and setup are described in each package's README. The example app with everything attached is [`examples/other-site`](examples/other-site).

## Development

```sh
pnpm install          # install
pnpm lint             # lint (fix with pnpm lint:fix)
pnpm check:korean     # check that Korean strings in runtime code live only in the message dictionaries
pnpm typecheck        # type check all packages
pnpm build            # build all packages (core → syntax-directive → admin → ai → blocks → bareun → seo)
pnpm test:run         # tests (needs Postgres)
pnpm example:check    # pack the packages, install them into the example app and build it
```

On commit, the code check (lint-staged) and the commit message check (commitlint) run automatically. Write commit messages in English as `type(scope): subject` (for example `feat(core): add thing`). Pick the scope from `core`, `admin`, `ai`, `blocks`, `seo`, `bareun`, `syntax`, `example`, `scripts`, `ci`, `deps`, `release`, `repo`, or leave it out. On push, lint, check:korean and typecheck run.

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
