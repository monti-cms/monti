# Monti

English | [한국어](README.ko.md)

A CMS for developer blogs.

The name is short for Montaigne. In Italian, "monti" also means "mountains".

## Status: being rebuilt

Monti is being rebuilt. The previous packages were removed; the last commit with them is `9c69629f`. The core (`packages/core`) is rewritten
first, from [`docs/refactor/core.md`](docs/refactor/core.md); the other packages follow, each from its own document in
[`docs/refactor`](docs/refactor). Until the first release is out, the [releases page](https://github.com/monti-cms/monti/releases) is empty.

- The design is in [`docs/refactor`](docs/refactor): `core.md` first, then one document for each package that follows.
- The screens it is built against are the reference stories (`Screens/Reference`) in the design system's Storybook.

## Packages

| Package | What it is |
|---|---|
| [`@monti-cms/core`](packages/core) | Operations (`defineOperation`), the engine that runs them (versions, undo snapshots, the activity log, deliveries, proposals) and the entry points they produce: the admin API, the agent tools and the CLI |
| [`@monti-cms/ui`](packages/ui) | The design system: tokens, the components the admin is built from, and the reference screens |
| [`@monti-cms/admin`](packages/admin) | The admin screens. They reach the server only through operations |
| [`@monti-cms/next`](packages/next) | Monti on a Next.js site: the admin page, the admin API route, the preview in draft mode, the cache refreshed on publish |
| [`@monti-cms/ai`](packages/ai) | The assistant: it runs a model over the site's operations and hands back proposals to review |
| [`@monti-cms/storage-s3`](packages/storage-s3) | Media files in S3 and what speaks its API (Cloudflare R2, MinIO): files go straight from the browser to the bucket |
| [`@monti-cms/mdx`](packages/mdx) | The MDX plugin: `.md` and `.mdx` files read into the body on import, and "View as MDX" in the editor |
| [`@monti-cms/seo`](packages/seo) | The SEO plugin: search and share fields in a tab of their own, their preview in the editor, and `seoOf` for the site's pages |

[`examples/blog`](examples/blog) is a blog on Next.js with Monti mounted on it; the flow tests (`pnpm test:e2e`) run on it.
[`examples/showcase`](examples/showcase) uses every feature, with a seed (`pnpm seed`) that fills it and a QA checklist.

## Installing a release

A release is one tarball for each package, on the [releases page](https://github.com/monti-cms/monti/releases), not on npm. A site names the
tarballs by their address; the packages name each other the same way, so the ones a site does not list follow. npm is the
package manager a release is proven with; pnpm and yarn are untried.
Each release's notes give the exact lines. For a Next.js site (App Router, Next 16 or later):

```sh
npm install \
  https://github.com/monti-cms/monti/releases/download/v<version>/monti-cms-core-<version>.tgz \
  https://github.com/monti-cms/monti/releases/download/v<version>/monti-cms-admin-<version>.tgz \
  https://github.com/monti-cms/monti/releases/download/v<version>/monti-cms-next-<version>.tgz
npx monti init        # writes the site's Monti files, adds what .env.local lacks, says what is left
npx monti doctor      # checks the set-up: files, environment, database, storage
```

`monti init` asks four things (the admin's address, the site's language, how the admin signs in, where media files go); each has a flag,
and `-y` takes the defaults. It writes only files the site lacks and never writes over one, so it can be run again. What it writes is in
[`packages/next`](packages/next), and [`examples/blog`](examples/blog) is a whole site. The admin brings its own stylesheet, already
built: the site needs no Tailwind for it.

The `monti` command reads the site's env files in the order Next does: what the environment already holds, then `.env.<mode>.local`,
`.env.local`, `.env.<mode>`, `.env` (`<mode>` is `NODE_ENV`, or `development`). `--env-file <path>` names one more, read first.

## Development

```sh
pnpm install            # install
pnpm lint               # lint (fix with pnpm lint:fix)
pnpm check:design       # admin UI rules (docs/design/admin)
pnpm check:review       # the admin UI is the one the design review read
pnpm typecheck          # type check all packages
pnpm build              # build all packages
CMS_TEST_DATABASE_URL=postgres://localhost/monti_test pnpm test   # the core tests, on a Postgres test database
pnpm --filter @monti-cms/ui storybook                             # the design system and the reference screens
```

### Releasing

```sh
node scripts/version.mjs 0.2.0     # every package gets the same version
git commit -am "chore(release): 0.2.0" && git tag v0.2.0 && git push --follow-tags
```

The tag starts the release workflow: it checks the version, builds, and lets the release out only through three gates. They run on every
push too, and by hand:

```sh
pnpm build
pnpm check:packages                # publint and arethetypeswrong on every packed tarball
DATABASE_URL=postgres://localhost/postgres pnpm try:release --shot admin.png
                                   # a new Next app outside this repo installs the tarballs with npm, builds, starts,
                                   # and a browser opens its admin (it makes a database of its own and drops it)
node scripts/pack-release.mjs out --base <address>   # the bundle itself: one tarball for each package
```

On commit, the code check (lint-staged) and the commit message check (commitlint) run automatically. Write commit messages in English as
`type(scope): subject` (for example `feat(core): add thing`); the scopes are in `commitlint.config.mjs`.

## Media storage

The media library keeps its files in a storage that a plugin brings. A site with none still runs: the library says how to connect one, and nothing can be uploaded.

```ts
import { createMonti, definePlugin, localFolderStorage } from "@monti-cms/core";

const monti = createMonti({
	// ...the rest of the site
	plugins: [definePlugin({ name: "media", storage: localFolderStorage({ dir: "./media" }) })],
});
```

`localFolderStorage` is for a development server, or a host with a disk: it keeps files in a folder, served by the admin API. A host that keeps
no disk, or takes only small requests, uses [`@monti-cms/storage-s3`](packages/storage-s3) (`npx monti init --storage s3` writes it): files go
straight from the browser to the bucket, and the server checks what arrived before any item names it. Any other place takes a plugin that
implements `Storage`.

## License

[MIT](LICENSE)
