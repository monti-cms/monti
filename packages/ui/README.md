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

The sidebar has five tiers, from the smallest part to the product's own: **Foundations** (the token pages), **Primitives** (layout atoms, text, icons and the AI mark: Box, Stack, Grid, Text, Icon, Label, Separator ...), **Controls** (what a person operates, by group: Button, Field, Choice, Tabs, Menu, Overlay, Status), **Patterns** (what is assembled from controls: List, Frame, Sheet) and **Monti** (what only a CMS has: EditorTools, Change, Proposal, Assistant, Translation). A story title is `Tier/Name` for Foundations and Primitives and `Tier/Group/Name` for the others, and every story sits in exactly one tier (`storySort` in `.storybook/preview.tsx`). Inside a tier, and for the screens, the sidebar and each component's stories go from A to Z.

The admin's screen states (load failures, empty lists, open dialogs) join the same catalog from `packages/admin`, under `Screens`, after the five tiers.

Stories show what the admin shows in Korean: `<html lang="ko">`, the words the components write themselves (`UiLabels`: close, cancel, save...) from `.storybook/ko-labels.ts`, and sample text in Korean. The toolbar's Language switches to the components' English defaults.

## Development

```bash
pnpm gen:tokens   # after editing tokens/tokens.json
pnpm gen:tokens --check   # what CI runs: names each generated file that differs, writes nothing
```

`pnpm check:design` (`scripts/check-design.mjs`, rule `off-system`) fails on any class outside the system in this package, the admin and the first-party plugins.
