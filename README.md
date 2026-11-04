# Monti

English | [한국어](README.ko.md)

A CMS for developer blogs.

The name is short for Montaigne. In Italian, "monti" also means "mountains".

## Status: being rebuilt

Monti is being rebuilt from its design. The previous packages were removed; the last commit with them is `9c69629f`. There is no release to install
until the rebuild reaches it.

- The design is in [`docs/design/features`](docs/design/features/README.md): one document per feature, and the order they are built in
  ([`build.md`](docs/design/features/build.md)). How far it has come and what is left is in [`docs/tracker.md`](docs/tracker.md).
- The screens it is built against are the reference stories (`Screens/Reference`) in the design system's Storybook.

## Packages

| Package | What it is |
|---|---|
| [`@monti-cms/core`](packages/core) | Operations (`defineOperation`), the engine that runs them (versions, undo snapshots, the activity log, deliveries, proposals) and the entry points they produce: the admin API, the agent tools and the CLI |
| [`@monti-cms/ui`](packages/ui) | The design system: tokens, the components the admin is built from, and the reference screens |

## Development

```sh
pnpm install            # install
pnpm lint               # lint (fix with pnpm lint:fix)
pnpm check:design       # admin UI rules (docs/design/admin)
pnpm check:operations   # the feature docs and the code name the same operations
pnpm typecheck          # type check all packages
pnpm build              # build all packages
CMS_TEST_DATABASE_URL=postgres://localhost/monti_test pnpm test   # the core tests, on a Postgres test database
pnpm --filter @monti-cms/ui storybook                             # the design system and the reference screens
```

On commit, the code check (lint-staged) and the commit message check (commitlint) run automatically. Write commit messages in English as
`type(scope): subject` (for example `feat(core): add thing`); the scopes are in `commitlint.config.mjs`.

## License

[MIT](LICENSE)
