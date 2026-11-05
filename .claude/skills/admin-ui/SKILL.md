---
name: admin-ui
description: Rules for building or changing Monti admin UI (packages/admin screens, packages/ui parts, plugin screens shown in the admin). Load before writing or reviewing any admin component, style, story or screen, and before briefing an agent that will.
---

# Building Monti admin UI

The admin is one design system. Its rules are in `docs/design/admin`; this page is the short version and the order to work in. `pnpm check:design` enforces the mechanical rules in CI.

## Read first

1. `docs/design/admin/README.md`: principles and the section "관리자 화면 UI 만들기" (how to build admin UI).
2. `docs/design/admin/tokens.md`: which token to use for what.
3. The family page in `docs/design/admin/components/` for every part you touch.
4. The screen's part map in `docs/design/admin/screens/` (which part goes in each place and how it behaves; what it does not name is not used). Use only the parts it names; if a place needs another part, change the map first.
5. `docs/design/admin/screens.md` and the `flows/` file for the screen and flow you build.
6. The board on the canvas (https://claude.ai/artifact/BUBfqadfYBA1JZW9dT13co) for the look. Read the live version with the Artifact tool.

## Rules

- Style with `monti-*` token utilities only. No raw palette (`bg-gray-100`, `text-sm`) and no raw colors (`#fff`) anywhere. Screens use no arbitrary lengths (`w-[320px]`): a size belongs to a part in `@monti-cms/ui` (which may use its own measured lengths) or to a token in `packages/ui/tokens/tokens.json` and `tokens.md`.
- No new stylesheets or CSS classes. `packages/ui/styles/admin.css` holds only document-wide base rules. A state is a `data-` attribute with a `data-[…]:` variant.
- No `style={{}}` in screens, except a runtime-measured value marked `// design-allow: <reason>`.
- Parts live in `@monti-cms/ui`, with stories. Screens compose them and never import Radix, Base UI or `cva`.
- A part you add or change is named on its family page in `docs/design/admin/components/` in the same change.
- Before building something, search `packages/ui/src/index.ts` and the component pages for an existing part. Reuse it; extend it with a prop only if the docs describe that variant.
- A place that takes input holds the input part itself from the start (`Input`, `Textarea`, `Combobox`, `Select`, `Switch` …). Never draw the value as text or a button that turns into the input when pressed.
- If the board disagrees with the docs or with an existing part (a width, a color, a label), do not pick one. Stop and report it.
- A map row or a board detail is not a reason by itself. For each part a place gets, say what the person does with it; a mark, line or column that repeats what is already shown is dropped (and the map changed), not built.
- No control is greyed out without its reason shown where the person acts (README principles 7–10).
- A pressable thing's shape comes from where it sits (button.md, 모양 기준): a pill on the page ground at one line's height; 6px only for rows in a floating surface and blocks taller than a line; no shape for text buttons, tabs and whole rows. Every pressable thing changes when pointed at; nothing that cannot be pressed shows a pointer.

## Order of work

1. Read the docs and the board.
2. List the parts the screen needs and which exist.
3. Build missing or changed parts in `@monti-cms/ui` first, with stories and their docs entry.
4. Then the screen, composing only those parts.
5. Run `pnpm check:design` with the other checks.
6. Before the change joins a shared branch, pass the three gates: `check:design`, the `design-review` agent on its diff, and a side-by-side of every changed state with its board at 1440×900.
7. Before handing a screen over, check what a still screenshot cannot show:
   - Measure the rows of each group (heights and gaps in px, from the DOM): one group, one control height, one gap.
   - Box controls (buttons, inputs, selects, chips, option and switch rows, menu rows, sidebar items) measure 36, 32, 28 or 24 and nothing else; a text control (`TextButton`, tabs, `FilterButton`, a drag handle) is pressable over at least 24px (`HIT_AREA`). `check:design` (`fixed-height`) catches raw heights in classes, not heights made of padding, so measure (tokens.md, 높이 기준).
   - Look at the in-between states: mid-drag (mouse held, screenshot), right after a press, after a retry or a reload.
   - Compare every panel with the board it reuses (a preview of the editor's property panel against the editor board), not only with its own map.
   - An agent's "matches the board" is a claim: look yourself.

## When you brief another agent

Admin UI needs design judgment: give it to the strongest model, in few large pieces (one parts piece first, one owner per screen); use a smaller model only for mechanical work with an exact spec. Do not retell the rules. Tell it to load this skill (`admin-ui`) first, name the docs pages and boards for its piece, and say which shared parts it may use and that it must not add parts to `@monti-cms/ui` unless that is its piece.
