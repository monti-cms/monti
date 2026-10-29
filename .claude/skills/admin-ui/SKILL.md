---
name: admin-ui
description: Rules for building or changing Monti admin UI (packages/admin screens, packages/ui parts, plugin screens shown in the admin). Load before writing or reviewing any admin component, style, story or screen, and before briefing an agent that will.
---

# Building Monti admin UI

The admin is one design system. Its rules are in `docs/design/admin`; this page is the short version and the order to work in. `pnpm check:design` enforces the mechanical rules in CI.

## Read first

1. `docs/design/admin/README.md`: principles and the section "Building admin UI".
2. `docs/design/admin/tokens.md`: which token to use for what.
3. The family page in `docs/design/admin/components/` for every part you touch.
4. `docs/design/admin/screens.md` and the `flows/` file for the screen and flow you build.
5. The board on the canvas (https://claude.ai/artifact/BUBfqadfYBA1JZW9dT13co) for the look. Read the live version with the Artifact tool.

## Rules

- Style with `monti-*` token utilities only. No raw palette (`bg-gray-100`, `text-sm`) and no raw colors (`#fff`) anywhere. Screens use no arbitrary lengths (`w-[320px]`): a size belongs to a part in `@monti-cms/ui` (which may use its own measured lengths) or to a token in `packages/ui/tokens/tokens.json` and `tokens.md`.
- No new stylesheets or CSS classes. `packages/admin/styles/admin.css` holds only document-wide base rules. A state is a `data-` attribute with a `data-[…]:` variant.
- No `style={{}}` in screens, except a runtime-measured value marked `// design-allow: <reason>`.
- Parts live in `@monti-cms/ui`, with stories. Screens compose them and never import Radix, Base UI or `cva`.
- A part you add or change is named on its family page in `docs/design/admin/components/` in the same change.
- Before building something, search `packages/ui/src/index.ts` and the component pages for an existing part. Reuse it; extend it with a prop only if the docs describe that variant.
- If the board disagrees with the docs or with an existing part (a width, a color, a label), do not pick one. Stop and report it.

## Order of work

1. Read the docs and the board.
2. List the parts the screen needs and which exist.
3. Build missing or changed parts in `@monti-cms/ui` first, with stories and their docs entry.
4. Then the screen, composing only those parts.
5. Run `pnpm check:design` with the other checks.
6. Before the change joins a shared branch, pass the three gates: `check:design`, the `design-review` agent on its diff, and a side-by-side of every changed state with its board at 1440×900.

## When you brief another agent

Admin UI needs design judgment: give it to the strongest model, in few large pieces (one parts piece first, one owner per screen); use a smaller model only for mechanical work with an exact spec. Do not retell the rules. Tell it to load this skill (`admin-ui`) first, name the docs pages and boards for its piece, and say which shared parts it may use and that it must not add parts to `@monti-cms/ui` unless that is its piece.
