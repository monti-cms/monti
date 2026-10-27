# @monti-cms/ui

Monti's design system: the tokens and the components the admin and its extensions are built from.

- **Tokens.** `tokens/tokens.json` is the design system's own token file and the single source. `pnpm gen:tokens` (at the repo root) writes `styles/tokens.css` (the values, light and dark, as `--monti-*` variables) and the token block of `styles/theme.css` (their names for Tailwind 4); a test fails when either differs from what the script writes. Every class carries `monti-` and then the design system's role name: colors per property (`bg-monti-tool`, `text-monti-faint`, `border-monti-muted`, `ring-monti-contrast`), the spacing scale (`gap-monti-12`, 2 to 48px), radii (`rounded-monti-md`), heights (`h-monti-control`, `h-monti-header`), widths (`w-monti-sidebar`, `max-w-monti-reading`), icon sizes (`size-monti-icon-md`), three shadows (`shadow-monti-floating`, `-overlay`, `-sheet`) and one type role per style, with size, line height, weight, letter spacing and family together (`text-monti-body` … `text-monti-display`).
- **Components.** Controls (`Button`, `IconButton`, `Input`, `Select`, `Combobox`, `Checkbox`, `Switch`, `Tabs`, ...), feedback (`Alert`, `Badge`, `StatusIndicator`, `Skeleton`, `Spinner`), overlays (`Dialog`, `Sheet`, `Popover`, `DropdownMenu`, `Tooltip`), and layout (`Text`, `Heading`, `Stack`, `Panel`, `Table`). Components take a role or a tone as props, never a raw value.
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

The admin's screen states (load failures, empty lists, open dialogs) join the same catalog from `packages/admin`.

## Visual regression

Every story of this package's catalog is shot in light and dark and compared with the PNGs in `visual/baselines`. The same page is checked for a sideways scroll, text cut by its box, and type-role classes (`text-monti-*`) that do not compute to their size. Admin screen stories are not shot until they carry the `visual` tag; a catalog story leaves out with `no-visual` (the rule is `visual/stories.ts`).

```bash
pnpm test:visual:docker           # compare, in the Linux image CI uses
pnpm test:visual:docker --update  # write the baselines again after a change that is meant
```

Baselines are made on Linux only (text is drawn differently per system), so `pnpm test:visual` refuses to run on macOS and Windows. When CI finds a difference it uploads the changed shots as the `visual-baselines` artifact: replace `visual/baselines` with it to accept them.

## Development

```bash
pnpm --filter @monti-cms/ui test:run
pnpm gen:tokens   # after editing tokens/tokens.json
```

The admin's design-system test (`packages/admin/src/__test__/design-system.test.ts`) fails on any class outside the system in this package, the admin and the first-party plugins.
