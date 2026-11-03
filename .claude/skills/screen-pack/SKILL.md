---
name: screen-pack
description: Make or change a design system's screen pack, the per-system half of the screen spec tool (board → screen spec JSON → drawn with the system's parts). Load when a new design system or a new board tool (Figma, PDF, another HTML) has to be turned into screen specs, when a part or prop is added to a pack, or when a converted board reports items outside the design system.
---

# Making a screen pack

The screen spec tool turns a board (a drawn screen) into a screen spec and draws that spec with a design system's parts. It has two halves:

- **The tool** (`packages/ui/src/spec`, `scripts/gen-screen-catalog.mjs`, `scripts/check-screens.mjs`, `scripts/convert-board.mjs`, `scripts/convert-board/html-adapter.js`). It is a fixed program: it checks, converts, draws and compares the same way every time. It names no design system. Never put a part name, a class, a token or an icon set in it; `pnpm check:screens` fails if you do.
- **The pack** (one folder per design system; Monti's is `packages/ui/src/spec-pack`). Everything that differs between design systems. Making it takes judgment, so it is your job; the person who owns the design system checks it.

Your work is the pack. What a screen becomes is the tool's work: do not hand-write a screen spec from a board, convert it.

The rules a pack must keep are in `docs/design/admin/screen-spec.md` (written in Korean for the owner). Read it first.

## What a pack holds

| File | What | Example (Monti) |
|---|---|---|
| `parts.tsx` | `parts`: the components a spec may name, by that name. Thin wrappers where a spec must not reach a prop (a wrapper that takes only `border`). | `Button`, `Stack`, `FormFieldLabel` |
| `parts.tsx` | `CATALOG`: each entry's kind (`part` or `layout`), its `role`, whether it takes `bind`, and every prop's kind. | `Button: { kind: "part", role: "button", props: { variant: "variant" } }` |
| `parts.tsx` | `SCREEN`: the spacing steps and the layout entry a group becomes. | `{ spacing: [2, 4, …, 48], group: "Stack" }` |
| `spacing.ts` | The class of each spacing step: gap, padding at each end, margin before. | `gap-monti-20` |
| `index.tsx` | The renderer: `createScreenSpec({ parts, catalog, spacing, join })`. | `ScreenSpec` |
| `html-board.js` | For HTML boards: which class names which part (`window.boardPack = { parts, known }`). One file per board tool; a Figma pack would have a Figma one. | `.mt-btn--primary` → `Button variant="primary"` |
| `pack.mjs` | The scripts' settings: where its screen specs are (`screens`), catalog file, board root and window size, modules to stand in for, how to read a dictionary. | `root: ".mt"` |
| `catalog.generated.json` | Written by `pnpm gen:screen-catalog --pack <dir>`. Never edit it. | |

## Steps for a new design system

1. **Read the design system.** Its docs, its components' prop types, its tokens. List its parts and, for each, the props a screen would set.
2. **Decide each prop's kind.** This is the decision that matters: it says whether the design system or the screen decides the value.
   - `variant` (a choice among looks) and `flag` (on or off): the design system decides.
   - `layout` and `layout-number`: only on `layout` entries (the container screens arrange with); the screen decides alignment, growing and a region's size. Never a distance: a distance is a Spacing item.
   - `text`: words, only as `{ text }`, `{ template, values }` or `{ state }`.
   - `ref` (another element, `@id`), `state` (a value only the data gives), `action` (a thing the screen does, by name), `data:field,field` (a list or object from the data, with its allowed fields), `event` (a handler, wired later).
   - A prop you give no kind cannot be written in a spec (default deny). Leave out what a screen should not set (a raw HTML attribute, a pixel size on a part, a class).
   - When unsure which side decides, ask the owner. Write your proposal as a short table: part, prop, kind, why.
3. **Mark roles.** The entry that is a form gets `role: "form"`; its submit button gets `role: "button"`.
4. **Write `spacing.ts`** from the design system's spacing tokens. Every step in `SCREEN.spacing` needs a class in each table.
5. **Write the board file** for the tool the boards are drawn in. For HTML: rules that read an element as a part (`match`, `part`, `props`, `leaf` for parts whose inside is not walked, `asProps` for inline styles that are one of the part's own props) and `known`, the classes the design system has. A board tool other than HTML needs an adapter of its own in the tool as well; propose it before writing it.
6. **Build and check.** `pnpm gen:screen-catalog --pack <dir>` (it stops on a kind that does not fit a prop's type, or a layout size on a part), then `pnpm check:screens --pack <dir>`.
7. **Convert one board.** `pnpm convert:board <url> --pack <dir> [--dictionary <module>] --out <file>`. Read the list it prints.

## Reading "outside the design system"

The converter fails while a board has something outside the design system, and lists it. For each line, propose one fix to the owner; never make the line go away by loosening the pack.

- **A part the design system lacks**: the board drew a component that is not in `parts`. Either the design system gets the part (a design decision for the owner), or the board uses an existing one.
- **A distance off the spacing steps**: express it as layout (a region's size or alignment) if it is one, or the board moves to a token.
- **A look drawn on a part by hand** (an inline color, a letter spacing): the part's own variant does it, the design system gets a variant, or the board drops it.
- **A line that is the pack's fault**: a class the board file does not know yet, an inline style the part already gives. Fix the pack's board file.

The screen's own layout (a region's width, centering, a line pinned to the bottom) is never on this list: it goes on the spec's layout entries.

## Done

- `pnpm gen:screen-catalog --pack <dir> --check` and `pnpm check:screens --pack <dir>` pass.
- One board converts with an empty outside list, or each line has a fix the owner has decided.
- The owner has seen the table of kinds.
