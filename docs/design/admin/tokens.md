# Admin design tokens

This page lists the Monti Admin tokens (color, type, spacing, radius, height, width, shadow, icon size), the role of each, and when to use it.

Token values live in `packages/ui/tokens/tokens.json`. That file is the single source in code: `pnpm gen:tokens` turns it into `packages/ui/styles/tokens.css`. The tables below copy its names, values and usage lines, so check the file if a value looks wrong. In CSS every token has the prefix `--monti-` (`bg-page` is `--monti-bg-page`), and the Tailwind theme names are in `packages/ui/styles/theme.css`.

## Naming

Each kind of token uses one naming pattern. The same word means the same thing in every kind.

| Kind | Pattern | Examples |
|---|---|---|
| Ground steps | number | `gray-1` to `gray-12` (light to dark), `success-3` / `success-11` (soft fill / text), `space-2` to `space-48` (the number is px) |
| Small ordered sets | `sm` `md` `lg` `xl` `full`, in this order only | `radius-sm` to `radius-xl`, `radius-full`, `height-control-sm` / `-md` |
| Roles | property-role | `bg-`, `fg-` or `border-` followed by a role word |
| Strength | muted < default < emphasis < strong < contrast | the same order in `bg`, `fg` and `border`; text has two more steps below muted: `subtle` and `faint` |
| Place | `page`, `tool` | `bg-page` (content), `bg-tool` (tools) |
| State | property-state-strength | `fg-danger`, `bg-danger-emphasis`, `bg-proposal-muted` |
| Fixed sizes | `height-` or `width-` | `height-header`, `width-sheet` |
| Shadow | name of the surface | `shadow-floating` (menus, cards, bubble), `shadow-overlay` (dialogs), `shadow-sheet` |
| Type | `text-` role | `text-page`, `text-body`, `text-meta` |

## Color

Color has two layers. The **scale** is the raw steps. The **roles** are what components use: a component names a role, never a scale step or a hex value.

### Two grounds

The admin has two grounds, and the choice of ground is the most visible color decision on a screen.

- **Paper, `bg-page`**: content. Lists, the editor body, settings, dialogs and menus.
- **Cream, `bg-tool`**: tools. The sidebar, the properties and assistant panels, sheets, the source pane and the status bar.
- In dark mode the tool ground is darker than the page (`bg-tool` is `gray-1`, `bg-page` is `gray-2`).

### Scale

Light and dark values of the raw steps. The status families (`success`, `warning`, `danger`, `proposal`) have only the steps the roles need: `-3` is a soft fill, `-9` is a mark (dots and rings), `-11` is text.

| Token | Light | Dark | Use |
|---|---|---|---|
| `gray-1` | `#faf9f5` | `#151412` | Paper. Page ground in light. |
| `gray-2` | `#f3f1ed` | `#1a1917` | Cream. Tool surfaces in light (sidebar, panels, sheets, status bar). |
| `gray-3` | `#f0eee9` | `#26241f` | Gray pill fill, inline boxes. |
| `gray-4` | `#eae7e0` | `#2b2925` | Row lines and selected rows. |
| `gray-5` | `#e6e4de` | `#2e2c28` | Divider lines. |
| `gray-6` | `#dcd8cf` | `#3a3833` | Borders of floating surfaces. |
| `gray-7` | `#c8c4b9` | `#5c5850` | Link underlines, quiet strokes. |
| `gray-8` | `#a8a396` | `#6f6a61` | Disabled marks. |
| `gray-9` | `#8c887f` | `#8a867d` | Faint text: placeholders and meta only. 3.4:1 on paper in light, so never for text people must read. |
| `gray-10` | `#75716a` | `#a29e95` | Subtle text: labels, captions, secondary meta. |
| `gray-11` | `#4a4741` | `#c9c6bd` | Muted text: secondary body text, text buttons. |
| `gray-12` | `#1c1b18` | `#ecebe6` | Ink. Body text, the black pill, the rule under page titles. |
| `success-3` | `#eaf3ee` | `#12241b` | Soft fill behind success. |
| `success-11` | `#336a4f` | `#86c09c` | Success text and dot (published). |
| `warning-3` | `#f9f2e2` | `#2a2010` | Soft fill behind warnings. |
| `warning-9` | `#aa7406` | `#e2b26b` | Warning dots, rings and markers. |
| `warning-11` | `#9a6200` | `#d9aa66` | Warning text (editing, unsaved, to-do). |
| `danger-3` | `#f8e8e8` | `#2b1618` | Soft fill behind errors and irreversible actions. |
| `danger-11` | `#a8353c` | `#e3918f` | Error text, the delete pill, failed states. |
| `proposal-3` | `#e4eaf8` | `#252b3c` | Blue pencil fill: text an AI proposal adds. |
| `proposal-11` | `#2f56c8` | `#93adf5` | Blue pencil: every mark of an AI proposal not yet accepted. Used for nothing else. |

### Surfaces

Backgrounds. Pick by what the surface is, not by how dark it should look.

- `bg-page` and `bg-tool` are the two grounds.
- `bg-muted` is the gray pill (the secondary action) and inline boxes.
- `bg-selected` is a selected or open item: the hovered sidebar row, a menu row under the pointer, an open status-bar cell, a filter chip, a selected list row.
- `bg-current` is the item open now in a list whose rows take `bg-selected` under the pointer (the sidebar, the collections column of the settings, the folder column of the media picker): the open item takes the next step up, so it is never mistaken for the row under the pointer. It also marks the pressed screen-mode cell. A list whose hover is `bg-muted` (the entry list) marks a picked row with `bg-selected`.
- `bg-emphasis` with `fg-on-emphasis` is the black pill: the one primary action of a screen or floating surface.
- `bg-highlight` marks text a request anchors to, or a found word. `bg-block` marks the editor block under the handle or menu. `bg-backdrop` dims the page behind a sheet or dialog.

| Token | Light | Dark | Use |
|---|---|---|---|
| `bg-page` | `gray-1` `#faf9f5` | `gray-2` `#1a1917` | Content ground: lists, the editor body, settings pages, dialogs, menus. |
| `bg-tool` | `gray-2` `#f3f1ed` | `gray-1` `#151412` | Tool ground: sidebar, properties and assistant panels, sheets, the source pane, the status bar. Darker than the page in dark. |
| `bg-muted` | `gray-3` `#f0eee9` | `gray-3` `#26241f` | Gray pill (secondary action), inline boxes, chips at rest. |
| `bg-selected` | `gray-4` `#eae7e0` | `gray-4` `#2b2925` | Selected or open item: nav item, menu row, open status-bar cell, filter chip. |
| `bg-current` | `gray-6` `#dcd8cf` | `gray-6` `#3a3833` | The item open now in a list whose hover is bg-selected (the sidebar, the settings collections column, the media picker folders), and the pressed screen mode: one step above the hover. |
| `bg-highlight` | `#e8e1cf` | `#3a352a` | Text highlight: a request anchor, a found word. |
| `bg-block` | `#efe9dc` | `#2a2722` | Editor block under the handle or menu. |
| `bg-emphasis` | `gray-12` `#1c1b18` | `gray-12` `#ecebe6` | The black pill: the one primary action of a screen or floating surface. |
| `bg-backdrop` | `rgba(28, 27, 24, 0.18)` | `rgba(10, 9, 8, 0.55)` | Dims the page behind a sheet or dialog. |

### Text

Text colors, from strongest to weakest: `fg-default`, `fg-muted`, `fg-subtle`, `fg-faint`.

- `fg-faint` is 3.4:1 on paper in light, which fails 4.5:1. Use it only for placeholders and meta, never for text people must read.
- The black pill uses `fg-on-emphasis`.

| Token | Light | Dark | Use |
|---|---|---|---|
| `fg-on-emphasis` | `gray-1` `#faf9f5` | `gray-2` `#1a1917` | Text on the black pill. |
| `fg-default` | `gray-12` `#1c1b18` | `gray-12` `#ecebe6` | Body text, titles. |
| `fg-muted` | `gray-11` `#4a4741` | `gray-11` `#c9c6bd` | Secondary text, text buttons. |
| `fg-subtle` | `gray-10` `#75716a` | `gray-10` `#a29e95` | Labels, captions, tab labels at rest. |
| `fg-faint` | `gray-9` `#8c887f` | `gray-9` `#8a867d` | Placeholders, meta, disabled. Not for text that must be read (fails 4.5:1 in light). |

### Borders

Lines get heavier with strength. Rows use `border-muted`, sections and tool edges `border-default`, floating surfaces `border-emphasis`, text-button underlines `border-strong`. `border-contrast` is ink: the rule under a content page title.

| Token | Light | Dark | Use |
|---|---|---|---|
| `border-muted` | `gray-4` `#eae7e0` | `gray-4` `#2b2925` | Lines between list rows. |
| `border-default` | `gray-5` `#e6e4de` | `gray-5` `#2e2c28` | Section and toolbar lines, tool panel edges. |
| `border-emphasis` | `gray-6` `#dcd8cf` | `gray-6` `#3a3833` | Edge of menus, dialogs, sheets, the bubble. |
| `border-strong` | `gray-7` `#c8c4b9` | `gray-7` `#5c5850` | Underline of text buttons and links. |
| `border-contrast` | `gray-12` `#1c1b18` | `gray-12` `#ecebe6` | The rule under a content page title. Nowhere else. |

### Tones

Color is for state only. Any other emphasis uses weight and ink color. A state always pairs its color with a shape or a word, never color alone.

- **Success** (`fg-success`): published, done.
- **Warning**: two colors. Text is `fg-warning` (`#9a6200`, dark enough to read). Dots, rings and marks are `bg-warning-emphasis` (`#aa7406`, one step lighter). They are the same amber family, so they read as one color side by side. `bg-warning-emphasis` is for marks only: text on top of it does not reach 4.5:1. Where text sits on an amber ground (the lit source marker), use `fg-warning` as the ground.
- **Danger** (`fg-danger`): errors, delete, cannot undo. Something that failed (a failed delivery) is danger, not warning.
- **Proposal** (`fg-proposal`, `bg-proposal-muted`): the blue pencil. It marks an AI proposal that has not been accepted yet and is used for nothing else.
- Entry status uses shape and color together: published is a filled dot, editing a filled dot in amber, draft an empty ring, archived a short bar. In a list's status column "published" is the ordinary case and is written in the quiet color (`.mt-status--quiet`, `fg-subtle`).

| Token | Light | Dark | Use |
|---|---|---|---|
| `fg-success` | `success-11` `#336a4f` | `success-11` `#86c09c` | Published, done. |
| `fg-warning` | `warning-11` `#9a6200` | `warning-11` `#d9aa66` | Editing, unsaved, to-do. |
| `fg-danger` | `danger-11` `#a8353c` | `danger-11` `#e3918f` | Errors, delete, cannot undo. |
| `bg-success-muted` | `success-3` `#eaf3ee` | `success-3` `#12241b` | Tint behind a success note or marker. |
| `bg-warning-muted` | `warning-3` `#f9f2e2` | `warning-3` `#2a2010` | Tint behind a warning note or marker. |
| `bg-warning-emphasis` | `warning-9` `#aa7406` | `warning-9` `#e2b26b` | Warning dots, rings and markers. |
| `bg-danger-muted` | `danger-3` `#f8e8e8` | `danger-3` `#2b1618` | Tint behind an error note or a removed line. |
| `bg-danger-emphasis` | `danger-11` `#a8353c` | `danger-11` `#e3918f` | The delete pill. |
| `fg-proposal` | `proposal-11` `#2f56c8` | `proposal-11` `#93adf5` | Blue pencil text and strokes. |
| `bg-proposal-muted` | `proposal-3` `#e4eaf8` | `proposal-3` `#252b3c` | Blue pencil fill under added text. |

## Type

Two families: Pretendard for text and IBM Plex Mono for addresses, numbers and labels. Pretendard ships as `fonts/PretendardVariable.woff2`, loaded by the `@font-face` at the top of `tokens.css`. Noto Sans KR is the fallback, used only when Pretendard cannot load. The full stacks:

- `sans`: `Pretendard, "Noto Sans KR", "Apple SD Gothic Neo", system-ui, sans-serif`
- `mono`: `"IBM Plex Mono", ui-monospace, Menlo, monospace`

Pick a role by what the text is. Sizes are px.

| Token | Family | Size / line | Weight | Tracking | Use |
|---|---|---|---|---|---|
| `text-display` | sans | 36 / 45 | 700 | -0.025em | The entry title in the editor. |
| `text-page` | sans | 26 / 32 | 700 | -0.02em | Content page title, above the ink rule. |
| `text-heading` | sans | 22 / 30 | 700 | – | Headings in the editor body; dialog titles at 20px use this role. |
| `text-reading` | sans | 17 / 30 | 400 | – | Editor body text. |
| `text-title` | sans | 16 / 22 | 600 | – | Panel and sheet titles, section titles in settings. |
| `text-body` | sans | 14 / 20 | 400 | – | Default UI text, buttons, inputs, and list row titles (in ink; the other cells are gray). |
| `text-label` | sans | 13 / 18 | 500 | – | Tabs, filters, small buttons. |
| `text-note` | sans | 13 / 20 | 400 | – | Secondary lines under a row title, hints that cannot be avoided. |
| `text-caption` | sans | 12 / 16 | 400 | – | Captions, timestamps in sans. |
| `text-meta` | mono | 12 / 16 | 400 | – | Addresses, identifiers, counts, file sizes. |
| `text-micro` | mono | 11 / 14 | 400 | – | Field labels, group labels in menus and panels. |

Rules for type:

- Centering text in a box is the font's job. Fixed-height parts (buttons, chips, menu rows, status-bar cells) use equal padding above and below. Do not add 1 to 2px of extra bottom padding to lift the text. If the text looks off, fix the font: set `ascent-override` and `descent-override` in `@font-face`. Pretendard needs none today. The Korean ink must land within 0.75px of the box center, and it does (measured: button 0.05px, chip 0.6px).
- Weights are light on purpose. Bold is used for panel and section titles (600), the selected tab (600, or 700 in the toolbar under a page title) and page titles. Small text (11px), labels and gray pills are 400; raising them to 500 made the whole screen look heavy.
- A list is a table, so a row title is `text-body` (14 / 400). Its ink color and its place in the first column make it read before the gray cells.
- Sizes outside the scale: dialog titles are 20px (the `text-heading` role); the request marker in the margin is 10px mono, the one text smaller than `text-micro`.

## Spacing

Only these steps. Any other value is not used. `space-10` is used only for the top and bottom padding of a list row.

| Token | Value | Use |
|---|---|---|
| `space-2` | 2px | Between stacked label and value. |
| `space-4` | 4px | Icon to text inside small controls. |
| `space-6` | 6px | Dot to label, chip insides. |
| `space-8` | 8px | Between related controls. |
| `space-10` | 10px | List row padding (top and bottom). |
| `space-12` | 12px | Row padding, field gaps. |
| `space-16` | 16px | Gaps in toolbars and button groups. |
| `space-20` | 20px | Between tabs and filters; field gaps in sheets. |
| `space-24` | 24px | Panel and sheet side padding. |
| `space-32` | 32px | Between sections inside a page. |
| `space-40` | 40px | Page top padding; column gap in settings. |
| `space-48` | 48px | Page side padding. |

## Radius

| Token | Value | Use |
|---|---|---|
| `radius-sm` | 3px | Checkboxes, text marks (blue pencil, highlight). |
| `radius-md` | 6px | Menu rows, selected nav items, tiles, images. |
| `radius-lg` | 8px | Inline boxes: summaries, segmented controls, test results. |
| `radius-xl` | 12px | Floating surfaces: menus, popovers, dialogs, cards in chat. |
| `radius-full` | 999px | Every pill: buttons, chips, the bubble, switches, dots. |

Buttons and inputs have no shadow, and cards and boxes are not used to group content: lines and space do that. A box border is for floating things only (menus, dialogs, sheets, bubbles).

## Height

| Token | Value | Use |
|---|---|---|
| `height-control-md` | 36px | Height of pills and inputs in page headers and dialogs. |
| `height-control-sm` | 28px | Small pills, chips, buttons inside cards. |
| `height-icon-button` | 32px | Round icon buttons (square: width = height). |
| `height-header` | 60px | App header of the editor, tool panel and sheet headers. |
| `height-toolbar` | 48px | Tab and filter rows under a page title. |
| `height-panebar` | 44px | Bars inside a pane: source pane head, properties tabs. |
| `height-statusbar` | 30px | Status bar. |

## Width

| Token | Value | Use |
|---|---|---|
| `width-sidebar` | 232px | Sidebar width. |
| `width-rail` | 48px | Sidebar folded to its icons. |
| `width-menu` | 240px | Menus and popovers with a fixed width. |
| `width-panel` | 300px | Properties panel. |
| `width-side-panel` | 360px | Record, media and activity side panels. |
| `width-assistant` | 380px | Assistant panel. |
| `width-sheet` | 520px | Sheets. |
| `width-content` | 880px | Width of settings and form pages, and the least a list page is. |
| `width-list` | 1200px | The most a list page (entries, media, trash, the tables of tools) grows to on a wide window. |
| `width-reading` | 680px | Max width of the editor column. |

## Shadow

Three shadows. Buttons and inputs have none. A panel's edge is an inset line, not a shadow.

| Token | Light | Dark | Use |
|---|---|---|---|
| `shadow-floating` | `0 12px 32px rgba(40, 32, 20, 0.14)` | `0 12px 32px rgba(0, 0, 0, 0.5)` | Menus, popovers, the selection card, the bubble. |
| `shadow-overlay` | `0 24px 60px rgba(30, 24, 14, 0.18)` | `0 24px 60px rgba(0, 0, 0, 0.6)` | Dialogs. |
| `shadow-sheet` | `-20px 0 50px rgba(30, 24, 14, 0.12)` | `-20px 0 50px rgba(0, 0, 0, 0.5)` | Sheets from the right edge. |

## Icon size

Icons come from IBM Carbon only (`@carbon/icons` 11.90.0, Apache-2.0). Do not add another icon set or draw an icon by hand.

| Token | Value | Use |
|---|---|---|
| `size-icon-xs` | 12px | Icons inside chips and counts. |
| `size-icon-sm` | 14px | Icons beside 13px text and in small buttons. |
| `size-icon-md` | 16px | Default icon size in menus, buttons and rows. |
| `size-icon-lg` | 20px | Icons in empty states and large buttons. |

- Draw icons on the 16px grid at 16px (menus, buttons, rows, tabs). Only larger places use 20px, such as the preview of a file tile. If Carbon ships a drawing made for that size, use it. If not, scale down the 32px original (this is how the Carbon components do it).
- Keep the shape Carbon gives: filled areas, 1px strokes at 16px. Do not change the stroke or redraw an icon.
- Color is `currentColor`, so an icon follows the text around it (menu icons `fg-subtle`, danger `fg-danger`).
- The one mark made in-house is the spark, ✦ (`.mt-spark`, `Spark` in code), which means AI. The block handle and the row drag dots are handles, not icons, and stay as they are. Working is shown by `.mt-spinner` (`Spinner`), not by an icon.
- If no icon fits exactly, use the closest Carbon one. Do not draw a new one. A heading level is Carbon `heading` plus a small mono number (`.mt-ico-level`, "H2"; `HeadingIcon` in code).
- The map from lucide names to Carbon names is the same table the admin code uses.

## Normalized values

The mockups disagreed with each other in many small ways. These choices settled them.

- **Light weights.** See the type rules above.
- A list row has 10px above and below. The line between rows is as wide as the ink rule under the title. Only the background of a selected row extends 12px past the row on each side.
- Under a title, tabs are bold text without an underline. Underlined tabs are for the top of a pane and for language tabs.
- Pill height was 34 or 36 and is now **36** (28 only inside cards). The editor header's 34 became 36 too.
- Settings section titles were 15px and are now **16** (`text-title`). List row titles are table items, so `text-body`. Text of 9 and 10px became **11** (`text-micro`); only the request marker stays at 10.
- Editor body text went from 16 / 17 to **17 / 30**. The translation window title went from 30 to **36**, the same as an entry title.
- Radius 2, 3, 5 and 7 became **3** (`sm`) or **6** (`md`). Menus and dialogs went from 12 to `xl`.
- Spacing 7, 14 and 18 became the nearest step (6, 16, 20). Step names are px numbers (`space-6`), not words like hair, snug or relaxed, because a word does not say which is larger.
- The strength words were in a different order per kind and are now one order: `bg-neutral` is `bg-muted`, `border-floating` is `border-emphasis`, `border-underline` is `border-strong`, `border-ink` is `border-contrast`.
- Size names put the axis first: `size-header` became `height-header`, `size-sheet` became `width-sheet`.
- The row line (`#ebe9e3`) and the selected background (`#eae7e0`) became one token, **gray-4**.
- Six shadows became **three** (floating, overlay, sheet). Button shadows (`shadow-btn`, `shadow-control`, `shadow-card`) are gone.

## In code

- Components never take raw values. They read tokens through the Tailwind theme (`bg-monti-page`, `text-monti-subtle`, `gap-monti-8`) and `packages/ui/styles/theme.css` names them.
- `tokens.generated.ts` in `packages/ui/src` exports the `Background` and `Spacing` types built from the same file.
- Each type role also becomes four variables in CSS: `--monti-text-<role>-size`, `-line`, `-weight` and `-tracking`, plus `--monti-font-sans` and `--monti-font-mono`.
- A site can override any `--monti-*` variable on `:root`, `.dark` or `[data-theme="dark"]`. The defaults have zero specificity, so a site's override wins in any stylesheet order.
- Dark mode is a `dark` class (or `data-theme="dark"`) on a wrapping element. All role colors and shadows change inside it.
- Storybook shows every group on a Foundations page: `packages/ui/src/foundations/`.

## Mismatches

These are the differences found between `packages/ui/tokens/tokens.json` (code) and the design system's `tokens.json` (the Monti Admin DS), and between the tokens and the DS README. None is resolved here.

**The two `tokens.json` files.** Every token name, light and dark value, type style, spacing, radius, shadow, height, width, size and the two font stacks are identical. The files differ only in these places:

- `warning-9` usage. Code: "Warning dots, rings and markers." DS: "Warning dots, rings and markers: a step brighter than the text so it reads as a warning (3:1 on the page)."
- `bg-warning-emphasis` usage. Code: "Warning dots, rings and markers." DS: "Warning dots, rings and markers (editing, unsaved change, to-do ring)."
- `width-rail` usage. Code: "Sidebar folded to its icons." DS: "Folded sidebar: icons only."
- Entry order. `warning-9` and `bg-warning-emphasis` sit in a different position in the list. The values are the same.

**Code only.** `theme.css` has `monti-divider` (`--background-color-monti-divider`, `--stroke-monti-divider`), an alias of `border-muted` that neither `tokens.json` lists. Menu separators use it.

**Tokens and the DS README.**

- The README token table does not list `bg-highlight`, `bg-block`, `bg-backdrop`, `bg-success-muted`, `bg-warning-muted`, `bg-danger-muted`, `width-rail`, `width-menu`, `width-list` or the `size-icon-*` tokens. Both `tokens.json` files have them.
- The README's section on how the system connects to `@monti-cms/ui` still describes `bg-tool` (replacing `bg-inset`), `bg-neutral` (renamed `bg-muted`) and the `spacing-*` names as changes to come. Code already uses the new names.
- `border-contrast` usage says "The rule under a content page title. Nowhere else." The Field README draws a focused underline with `border-contrast`, and the Tabs README draws the selected tab's underline in ink (the code uses `border-monti-contrast` for both).
- `bg-muted` usage says "chips at rest" while `bg-selected` usage says "filter chip". The DS stylesheet draws `.mt-chip` on `bg-selected`.
- The README says the selected tab is 700. The Tabs README and the stylesheet make it 600, with 700 only in the toolbar under a page title.
- The README says small text, labels and gray pills went back to weight 400. `text-label` in both `tokens.json` files is 500, and the stylesheet draws `.mt-btn` and `.mt-chip` at 600.
