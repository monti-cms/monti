---
name: screen-pack
description: Make or change a design system's screen pack, the per-system half of the screen spec tool (board → screen spec JSON → drawn with the system's parts). Load when a new design system or a new board tool (Figma, PDF, another HTML) has to be turned into screen specs, when a part or prop is added to a pack, or when a converted board reports items outside the design system.
---

# Making a screen pack

The screen spec tool turns a board (a drawn screen) into a screen spec and draws that spec with a design system's parts. It has two halves:

- **The tool** (`packages/ui/src/spec`, `scripts/gen-screen-catalog.mjs`, `scripts/check-screens.mjs`, `scripts/convert-board.mjs`, `scripts/convert-board/html-adapter.js`). It is a fixed program: it checks, converts, draws and compares the same way every time. It names no design system. Never put a part name, a class, a token or an icon set in it; `pnpm check:screens` fails if you do.
- **The pack** (one folder per design system; Monti's is `packages/ui/src/spec-pack`). Everything that differs between design systems. Making it takes judgment, so it is your job; the person who owns the design system checks it.

Your work is the pack. What a screen becomes is the tool's work: do not hand-write a screen spec from a board, convert it.

The rules a pack must keep are in `docs/design/admin/screen-spec.md` (written in Korean for the owner). Read it first. Its examples (`Stack`, `px-monti-24`, the spacing scale) are Monti's pack; the rules around them hold for every pack.

Put a new pack in a folder under a package's `src` (as Monti's is), so its `.tsx` files get the package's JSX settings.

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

## What the tool expects of a pack

- **One layout entry** (`kind: "layout"`, named in `SCREEN.group`): the container screens arrange with and groups become. Its props use the tool's layout words, because the converter writes them: `direction` (`"column" | "row"`), `align`, `justify`, `grow`, `width`, `maxWidth`, `minWidth`, `minHeight`. Give each the kind `layout` or `layout-number`, and leave out what the design system has no use for (the converter then reports a board that needs it). It takes `className` and puts it on its element: the spacing classes go there.
- **Every part that a Spacing class may land on takes `className`** (a margin before it, a padding when it is merged). A part that cannot take one is never a direct child of the layout entry.
- **A form and its button**, if screens send forms: an entry with `role: "form"` that renders a `<form>` posting to its `action` prop, and the button with `role: "button"` (the renderer sets its `type`).
- **A label that names its field** takes a `ref` prop and renders it as `htmlFor`; a field that takes `bind` accepts `id`, `name` and `value` (its first value) from the renderer. See Monti's `FormFieldLabel` and `Input` wrappers in `packages/ui/src/spec-pack/parts.tsx`.
- **`pack.mjs`** has `screens` (folders of its `*.screen.json`, relative to the pack), `catalog`, and for HTML boards `board: { classes, root, viewport, page }` (`page` is the layout the board's root gets as the page, `{ minHeight: "screen" }` or `{}`). `stubs` (module name → source) stands in for modules a dictionary imports that the scripts cannot load; `dictionary(module)` turns a dictionary module into `{ text as drawn: key }`. A pack without dictionaries leaves both out; `--dictionary` is then not used, and every drawn word becomes a value of the state (`/drawn/…`) for someone to name.

## How an HTML board is read

- **A group** is a plain element with no design system class (a bare `div` with flex styles). Its inline layout (`max-width`, `width` in px, `align-items`, `justify-content`, `flex-grow`) is the screen's layout and goes on the layout entry; a class of the board's own on it is a look and is reported.
- **A part** is an element a rule in `html-board.js` matches. A rule has `match(el)`, `part`, and optionally:
  - `props(el)`: the part's props read off the element (a variant from a modifier class).
  - `leaf: true`: the inside is not read (a separator whose words are its label, an icon).
  - `walk: "parts"`: the inside is read as the part's children, without distances (the part spaces its own inside; a margin the board adds in there is reported).
  - `asProps`: inline styles that are one of the part's own props (`text-align` as `align`), so they are not reported as looks.
- `known`: a pattern of every class the design system has. Any other class is reported.
- A distance is measured between elements as laid out (margins, gaps, padding and empty spacer elements alike), so the board may be drawn the tool's natural way.

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
7. **Convert one board.** `pnpm convert:board <url> --pack <dir> [--dictionary <module>] --out <file>` (a local file works as `file:///…`). Read the list it prints. With `--out` it also writes `<file>.data.json`, the drawn words no dictionary named.
8. **Draw it.** The pack's renderer (`ScreenSpec` from its `index.tsx`) takes the spec, `data` (the state; for a converted board, the `.data.json`), `text(key, values)` (the dictionary, `undefined` for a key it lacks) and `actions` (addresses by action name). Draw it with `renderToStaticMarkup` and check that only the pack's classes appear and no element stands for empty space.

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
