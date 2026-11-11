Monti is being rebuilt from the feature docs in `docs/design/features` (order and rules in its `build.md`). Before any work, read `docs/tracker.md`: take the open items ("남은 일") of the doc you build into the PR, and write down any work you put off there, with the doc it is to be done with, never only in a PR description. `pnpm check:operations` refuses to mark a doc done while it has open items.

Docs under `docs/` are written in Korean: the owner reads and approves them. Code names, file paths, tokens and commands in them stay as they are in the code. Everything else is in English (code comments, test titles, READMEs, error messages, commits, PRs); Korean appears elsewhere only in the `ko` message dictionaries, test data, Storybook stories and `README.ko.md`. When a `README.md` changes, update its `README.ko.md` in the same change.

Commit messages and PR titles follow Conventional Commits (`type(scope): subject`). The scopes are in `commitlint.config.mjs`; a new package adds its own.

Admin UI follows the rules in `docs/design/admin` (start at its README); change them in the same PR when a rule changes. Load the `admin-ui` skill first; `pnpm check:design` enforces its mechanical rules, and the `design-review` agent reviews each piece before it joins a shared branch. The agent records what it read; `pnpm check:review` fails a commit whose admin UI is not the one on record, and a hook refuses `gh pr merge` of such a pull request, so a screen changed after its review is reviewed again.

Prefer LSP for symbol navigation, references, types, rename and diagnostics.
