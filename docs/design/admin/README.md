# Monti Admin design

This folder holds the rules of the Monti Admin design system, so people and agents can read and link them without opening a design artifact.

The design system covers the admin screens: how they look, which parts they are built from, and the rules for using those parts. It was collected from the editorial mockups (the design canvas "A · 가운데 단") and arranged to fit the structure of `@monti-cms/ui`: colors in two layers (a ground step and a role), type by role, and spacing in named steps. The tokens and parts of `@monti-cms/ui` follow these docs.

## Principles

1. **Paper and cream, two layers.** Content (lists, the editor body, settings, dialogs, menus) is on paper, `bg-page`. Tools (the sidebar, the properties and assistant panels, sheets, the source pane, the status bar) are on cream, `bg-tool`. In dark mode tools are darker.
2. **The ink line is in one place.** There is a 1px `border-contrast` under a content page title. The head of a tool surface is `height-header` (60px) with one thin `border-default` line.
3. **Lines and space, not cards and boxes.** A box border is only for things that float: menus, dialogs, sheets, bubbles.
4. **One black pill per screen or floating surface.** Side actions are one or two gray pills, adding and editing inside a section are text buttons, and the rest is in ⋯.
5. **Color is for state only.** Other emphasis uses weight and ink color. The blue pencil, `fg-proposal`, is only for an AI proposal that has not been accepted yet.
6. **Structure instead of explanation.** If something is confusing, fix it with a name, a place or a state. No help text under a field, no reassuring sentences such as "~했어요" (it is done), no disclaimers.

## How to read these docs

Read in this order.

1. This page.
2. [tokens.md](tokens.md): colors, type, spacing, radius, heights, widths, shadows and icon sizes, with when to use each.
3. The component pages, from small to large. A page uses only the parts of the pages before it.
4. [screens.md](screens.md): each main board of the canvas and its states.
5. [flows/README.md](flows/README.md): the flows, step by step, which use the parts together. Each canvas flow has one test that walks it.

The component pages are grouped in five layers, in the same order as the Storybook of `@monti-cms/ui`.

| Layer | What | Pages |
|---|---|---|
| 1 Foundations | Color, type, spacing, radius, size, shadow | [tokens.md](tokens.md) |
| 2 Primitives | Layout pieces (Box, Stack, Grid), text, icons and the AI mark ✦, labels, separators, images, code blocks, panels, sections | No page of their own. The icon and type rules are in [tokens.md](tokens.md); `.mt-stack`, `.mt-line`, `.mt-label`, `.mt-vr`, `.mt-spark`, `.mt-panel` and `.mt-section` are at the top of the DS stylesheet |
| 3 Controls | What is pressed, typed, picked and what tells the state | [button](components/button.md), [field](components/field.md), [choice](components/choice.md), [tabs](components/tabs.md), [menu](components/menu.md), [overlay](components/overlay.md) (modal, popover, toast), [status](components/status.md) |
| 4 Patterns | The frame of a screen and lists | [list](components/list.md), [page-header](components/page-header.md), [sidebar](components/sidebar.md), [status-bar](components/status-bar.md), and the sheet and side panel in [overlay](components/overlay.md) |
| 5 Monti | Parts that only Monti has | [editor-tools](components/editor-tools.md), [change](components/change.md), [proposal](components/proposal.md), [assistant](components/assistant.md), [translation](components/translation.md) |

- The DS also has a Cover (Frame) group. It has no rule text; the frame pieces are described in the page-header, sidebar and status-bar pages.
- A folder can span two layers (Overlay). The table above splits it.
- The preview card groups in the DS artifact use the same layer names.

The component pages follow one pattern. Each part has its rules, then an "In code" note that names the `@monti-cms/ui` component, or says that it is not in code yet. DS class names (`.mt-…`) appear only where they map to the stylesheet of the DS artifact.

A part belongs to a group. Parts in one group share rules (height, line, color).

| Group | Page | What is in it |
|---|---|---|
| Pressing | Button | Pills (primary, secondary, danger, sm), text buttons, icon buttons, split pill |
| Input | Field | One line, several lines, select |
| | Choice | Checkbox and radio, switch, one of a few |
| | Tabs | Underlined tabs, filter chips |
| Notices | Status | Entry status, count, progress bar, notice strip |
| Surfaces | Menu | The floating menu card |
| | Overlay | Modal, sheet, side panel, name and value |
| Page | PageHeader | Title row, toolbar (chip row, bulk bar) |
| | List | List rows, grid cells, empty state |
| | Sidebar, StatusBar | Navigation, the bar under the editor |
| Editor | EditorTools | Block handle, format card |
| AI | Proposal | Blue pencil, bubble, request mark and card |
| | Assistant | Conversation, proposal card, input box |
| Schema | Change | Review of a schema change |
| Translation | Translation | Dimmed blocks, source changed, side by side |

## Where the visuals are

The docs hold the rules. For how things look, use these.

- **The canvas**: https://claude.ai/artifact/BUBfqadfYBA1JZW9dT13co. Boards for each screen, and pages for the flows. It holds how each screen and flow looks.
- **The DS artifact**: https://claude.ai/artifact/KoiQ42HjDgktbfSY7mx5ma. A visual catalog of the design system, with a preview of every part. The previews are a static render with the DS stylesheet, not the real React parts.
- **Storybook**: the real parts of `@monti-cms/ui` and the admin screens. Run it with `pnpm --filter @monti-cms/ui storybook` (it serves on port 6006). The sidebar has the five layers above. `packages/ui/README.md` describes the tiers, the visual tests and the audit.

## What is the source of truth

| What | Where |
|---|---|
| The rules: when to use a part, how it behaves, which states it has | These docs |
| Token values (names, light and dark) | `packages/ui/tokens/tokens.json`. `pnpm gen:tokens` generates `packages/ui/styles/tokens.css` from it; do not edit the CSS by hand |
| What each screen and flow looks like | The canvas |
| How a part is built | `packages/ui/src` and its stories |

When a rule changes, change it in these docs in the same pull request as the code, then update the artifacts (the canvas and the DS artifact) to match.

The Korean UI text in these docs is quoted exactly, with an English gloss at first use. Board names and state names stay in Korean in quotes, because that is how the canvas names them.

## Using the DS artifact

- Namespace: `MontiAdmin`. In the design canvas it is copied to `ds/montiadmin/`.
- Load `tokens.css` first, then `components/bundle.css`. The second file reads the variables of the first.
- `tokens.css` is generated from `tokens.json`; do not edit it by hand. It reads `fonts/` in the same folder, so move them together.
- Dark mode: a `dark` class (or `data-theme="dark"`) on the wrapping element. All role colors and shadows inside it change.
- Parts are used inside `.mt` (font, base size, button inheritance).

## Known gaps

- The component previews in the DS artifact are a static render with `components/bundle.css`, not a bundle of the real React parts of `@monti-cms/ui`.
- The IBM Plex Mono files are not included; the mockups load it from Google Fonts (Pretendard is in `fonts/`).
- There is no logo. The site name is written in letters.
- Primitives has no image part or code block in the DS (`@monti-cms/ui` has `Image` and `CodeBlock`).
