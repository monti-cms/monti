# @monti-cms/ui

Monti's design system: the tokens and the components the admin and its extensions are built from.

- **Tokens.** `tokens/tokens.json` is the design system's own token file and the single source. `pnpm gen:tokens` (at the repo root) writes `styles/tokens.css` (the values, light and dark, as `--monti-*` variables) and the token block of `styles/theme.css` (their names for Tailwind 4); `pnpm gen:tokens --check` (run in CI) fails when a generated file differs from what the script writes, and the script writes nothing when a text role falls under 4.5:1 on its ground or a role is declared twice. Every class carries `monti-` and then the design system's role name: colors per property (`bg-monti-tool`, `text-monti-faint`, `border-monti-muted`, `ring-monti-contrast`), the spacing scale (`gap-monti-12`, 2 to 48px), radii (`rounded-monti-md`), heights (`h-monti-control-md`, `h-monti-header`), widths (`w-monti-sidebar`, `max-w-monti-reading`), icon sizes (`size-monti-icon-md`), three shadows (`shadow-monti-floating`, `-overlay`, `-sheet`) and one type role per style, with size, line height, weight, letter spacing and family together (`text-monti-body` … `text-monti-display`); `font-mono` on the same element of a sans role always wins, and does not reach its children.
- **Components.** Controls (`Button`, `IconButton`, `Input`, `Select`, `Combobox`, `Checkbox`, `Switch`, `Tabs`, ...), feedback (`EntryStatus`, `Count`, `Banner`, `Progress`), overlays (`Dialog`, `Sheet`, `Popover`, `DropdownMenu`, `Tooltip`), and layout (`Text`, `Heading`, `Stack`, `Table`, `PageHeader`, `StatusBar`). Components take a role or a tone as props, never a raw value.
- **Built-in words.** A few components write words themselves (close, clear, pagination). They are English unless an app passes its own through `UiLabelsProvider`; the admin passes its dictionaries.

The admin's prebuilt stylesheet (`@monti-cms/admin/styles.css`) compiles this package, so a site imports nothing from here. An extension in another repository builds its own CSS with the same names:

```css
/* the extension's Tailwind entry */
@import "@monti-cms/ui/theme.css";
@import "tailwindcss/utilities.css" source(none);
@source "./src";
```

A site changes the look by overriding the tokens on `:root` (see the admin README, "Admin theme").

## Catalog

Every component in every variant and state, in light and dark:

```bash
pnpm --filter @monti-cms/ui storybook
```

The sidebar has five tiers, from the smallest part to the product's own: **Foundations** (the token pages), **Primitives** (layout atoms, text, icons and the AI mark: Box, Stack, Grid, Text, Icon, Label, Separator ...), **Controls** (what a person operates, by group: Button, Field, Choice, Tabs, Menu, Overlay, Status), **Patterns** (what is assembled from controls: List, Frame, Sheet) and **Monti** (what only a CMS has: EditorTools, Change, Proposal, Assistant, Translation). A story title is `Tier/Name` for Foundations and Primitives and `Tier/Group/Name` for the others, and every story sits in exactly one tier (`storySort` in `.storybook/preview.tsx`, checked by `storybook-parity.test.ts`). Inside a tier, and for the screens, the sidebar and each component's stories go from A to Z.

The admin's screen states (load failures, empty lists, open dialogs) join the same catalog from `packages/admin`, under `Screens`, after the five tiers.

Stories show what the admin shows in Korean: `<html lang="ko">`, the words the components write themselves (`UiLabels`: close, cancel, save...) from `.storybook/ko-labels.ts`, and sample text in Korean. The toolbar's Language switches to the components' English defaults. A test in `packages/admin` fails when the Korean list and the admin's own dictionary differ.

## Visual regression

Every story of this package's catalog is shot in light and dark and compared with the PNGs in `visual/baselines`. A part that moved by 1px or less, or a page 1px taller, counts as the same picture; a new color, a changed word, a part moved further or a size change of more than 1px fails (`visual/compare.ts`). Every story sees the same fixed time (`STORY_TIME` in `visual/page.ts`), so a calendar's today or a "3 minutes ago" does not change with the day of the run. The same page is checked for a sideways scroll, text cut by its box, type-role classes (`text-monti-*`) that do not compute to their size, an element that asks for mono (`font-mono`, `text-monti-meta`, `text-monti-micro`) and computes another face, an icon that sits off the line of the text of its button, link or tab, and the text of a fixed-height single-line control (button, chip, menu row, status bar cell) that sits more than 0.5px off the vertical center of its box, 0.75px for text in the mono face (measured from the font's own metrics: the ink of a Hangul or Latin capital against the box; see `findOffCenterText` in `visual/checks.ts`). Admin screen stories are not shot until they carry the `visual` tag, and then in light only (dark changes only color tokens, which the catalog covers); a catalog story leaves out with `no-visual` (the rule is `visual/stories.ts`). A screen story gets the tag only when it changes that screen's layout: loaded, empty, loading, its panels and modes, a dialog only that screen has. Open menus, confirm dialogs, load failures and toasts are left to the catalog's samples.

**The audit.** `pnpm test:visual:audit` runs those checks, and only those, over every story of the built Storybook (the admin's screens included, shot or not) in light and dark. A story that throws, or whose play function throws, fails before any check (Storybook only reports that in its panel). It compares no image, so it runs on any system. Run it at the end of each redesign epic: a finding is fixed, or written down under the issue that owns the screen. `MONTI_STORYBOOK_DIR=<a build>` points it at another build (the base branch) to tell what a branch broke from what was already there. Every run serves its own build on a free port, so two runs never look at each other's Storybook. CI runs it as its own step of the `visual` job, so it gates the job whether or not the comparison passed.

The baselines are made on the Linux image CI runs in and nowhere else, because text is drawn differently per system: `pnpm test:visual` refuses to run on macOS and Windows. CI is where they come from.

**In CI** the `visual` job runs on every push, split in four parts, each with its share of the shots and of the audit. A story that differs (or has no baseline yet) leaves its new shot behind, and when a part fails, the `visual baselines` job puts together the full set of baselines this code would have, without shooting again: the new shot where a story differs, the committed one elsewhere. The run's summary page lists each story that differs and by how much (`412 px differ (0.04%)`). If the change is meant, replace the two folders in `visual/baselines` with the `visual-baselines` artifact (so a removed story leaves no shot behind) and commit it with the change:

```bash
rm -rf packages/ui/visual/baselines/light packages/ui/visual/baselines/dark
gh run download <run-id> --name visual-baselines --dir packages/ui/visual/baselines
git add packages/ui/visual/baselines && git commit
```

If it is not meant, fix the code; the `visual-diff-<part>` artifacts hold each difference, with the differing pixels in red.

**On your machine,** Docker runs the same Linux image (the Playwright version of the install, the tag CI uses). The repo is copied into the container, so the host's `node_modules` is never touched:

```bash
pnpm test:visual:docker                              # compare with visual/baselines; diff images land in visual/test-results
pnpm test:visual:docker --baselines /tmp/shots --update   # take shots into a folder of your own, to look at them
```

An `--update` run replaces the `light` and `dark` folders of the target, so the shot of a renamed or deleted story does not stay behind.

Do not commit shots made this way: the CI runner has another CPU architecture than an Apple silicon Mac, and anti-aliasing differs a little between the two. What is committed always comes from CI.

## Development

```bash
pnpm --filter @monti-cms/ui test:run   # the code, the parts in jsdom, and the pointer, focus and visual-check tests in Chromium
pnpm gen:tokens   # after editing tokens/tokens.json
pnpm gen:tokens --check   # what CI runs: names each generated file that differs, writes nothing
```

`pnpm check:design` (`scripts/check-design.mjs`, rule `off-system`) fails on any class outside the system in this package, the admin and the first-party plugins.
