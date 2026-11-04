When working with code, prefer LSP for symbol navigation, references, type information, rename, and diagnostics when applicable.

Commit messages must be written in English and follow Conventional Commits (`type(scope): subject`). Allowed scopes (optional): core, auth, storage-s3, admin, ui, nextjs, ai, blocks, mdx, seo, registry, syntax, example, scripts, ci, deps, release, repo. Checked by commitlint (`commitlint.config.mjs`).

Pull request titles and descriptions must also be written in English. PR titles follow the same Conventional Commits format.

Design documents under `docs/` (`docs/design`, `docs/tracker.md`, `docs/testing.md`, `docs/testing/`) are written in Korean: the owner reads and approves them. Code names, file paths, tokens and commands in them stay as they are in the code.

Everything else is written in English: code comments, test titles, READMEs, error messages and other developer-facing text. Korean appears elsewhere only in the `ko` message dictionaries, in test data and Storybook stories (sample screens), and in the `README.ko.md` translations.

The admin design rules (tokens, parts, screens and flows) are in `docs/design/admin` (start at its README). Read them before changing admin UI, and change them in the same pull request when a rule changes. Before admin UI work, load the `admin-ui` skill (`.claude/skills/admin-ui`); `pnpm check:design` enforces its mechanical rules, and the `design-review` agent (`.claude/agents/design-review.md`) reviews each piece of admin UI work before it joins a shared branch.

When a `README.md` changes, update the matching `README.ko.md` in the same change.

Monti is being rebuilt from the feature docs in `docs/design/features` (order and rules in its `build.md`). Before any work, read `docs/tracker.md`: take the open items ("남은 일") of the doc you build into the PR, and write down any work you put off there, with the doc it is to be done with, never only in a PR description. `pnpm check:operations` refuses to mark a doc done while it has open items.
