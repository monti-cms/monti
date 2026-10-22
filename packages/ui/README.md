# @monti-cms/ui

Monti's design system: the tokens and the components the admin and its extensions are built from.

- **Tokens.** `styles/theme.css` names them for Tailwind 4; `styles/tokens.css` holds their light and dark values. Colors come in two tiers: base scales (`--monti-gray-1..12`, and accent, danger, warning and success at steps 3, 6, 9, 10, 11) and the roles screens use, one namespace per property (`bg-monti-surface`, `text-monti-muted`, `border-monti-default`). Type roles set size, line height and weight together (`text-monti-caption` … `text-monti-display`). Spacing is a 4px scale (0, 2, 4, 8, 12, 16, 24, 32, 48px), one shadow (`shadow-monti-floating`), four radii.
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

## Development

```bash
pnpm --filter @monti-cms/ui test:run
```

The admin's design-system test (`packages/admin/src/__test__/design-system.test.ts`) fails on any class outside the system in this package, the admin and the first-party plugins.
