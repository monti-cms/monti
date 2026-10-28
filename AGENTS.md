When working with code, prefer LSP for symbol navigation, references, type information, rename, and diagnostics when applicable.

Commit messages must be written in English and follow Conventional Commits (`type(scope): subject`). Allowed scopes (optional): core, auth, storage-s3, admin, ui, nextjs, ai, blocks, mdx, seo, registry, syntax, example, scripts, ci, deps, release, repo. Checked by commitlint (`commitlint.config.mjs`).

Pull request titles and descriptions must also be written in English. PR titles follow the same Conventional Commits format.

All documentation, code comments, test titles and developer-facing text are written in English. Korean appears only in the `ko` message dictionaries, in test data and Storybook stories (sample screens), in the `README.ko.md` translations, and quoted as UI text or board names in `docs/design/admin`.

The admin design rules (tokens, parts, screens and flows) are in `docs/design/admin` (start at its README). Read them before changing admin UI, and change them in the same pull request when a rule changes.

When a `README.md` changes, update the matching `README.ko.md` in the same change.
