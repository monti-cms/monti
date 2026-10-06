# @monti-cms/admin

English | [한국어](README.ko.md)

Admin UI (Next.js App Router) for `@monti-cms/core`. Provides the list, editor (tiptap), media, body templates, trash and login screens.
Plugins (e.g. `@monti-cms/ai`) add screens, sidebar items, field-side buttons and edit screen actions.
The screens only call the core's admin API (`/api/cms/v1/*`). You can also skip installing it and build your own screens against the same API.

## Setup

For installation, routes and styles, follow "Install in an empty Next app" in the `@monti-cms/core` README (`monti init` generates the admin route and style lines).

- **Admin path.** Defaults to `/admin`; change it with the site config's `admin.path` (e.g. `/studio`). The app's admin route folder
  (`app/(admin)/studio/[[...path]]/page.tsx` and `layout.tsx`) must use the same path. Links inside screens, the login redirect (`<admin path>/login`) and
  plugin screen URLs follow this path. Screen code builds URLs with `adminHref("/media")` and `adminEntryEditHref(id)` from `@monti-cms/core/client`.
  The admin API (`/api/cms/v1`) does not change.
- **View site.** `View site` below the sidebar opens `site.home` (default `/`). If the admin UI is on a different host, give a full URL.
- **Preview.** `Preview` on the edit screen appends the public path to `site.previewPath` and passes the language as `site.previewLocaleParam` (default
  `?locale=`). The URL in the search preview follows `site.localePrefix`.

## Adding site components

Field inputs, block edit screens and code fence previews are added by extensions, and the site can add to or override them (e.g. the block extension's Mermaid and chart provide a default
preview). Add them from a client component. If the site's provider sits inside the admin layout, the site's entry wins on the same name.

```tsx
"use client";
import { CmsAdminComponentsProvider } from "@monti-cms/admin";

const components = {
	fencePreviews: { chart: () => import("./chart").then((m) => m.Chart) }, // ({ source }) => ReactNode
	fieldInputs: { color: ColorInput }, // renders fields with fields.text({ input: "color" }) using this input
	blockEditors: { notice: NoticeEditor }, // property and body box of an added block ({ definition, values, setValue, content })
	blockViews: { banner: BannerView }, // whole edit screen of an added block (Tiptap NodeView). Takes precedence over blockEditors
};

export function SiteAdminComponents({ children }) {
	return <CmsAdminComponentsProvider components={components}>{children}</CmsAdminComponentsProvider>;
}
```

A fence nobody registers shows its source as is.

### Icons

A block definition's `editor.icon`, a plugin sidebar item's `icon`, a collection's `icon` and a code line effect's `icon` are lucide names.
The admin package includes only the commonly used icons, so register other names with the same provider's `icons`. Unknown names show a default icon
(puzzle, plug, etc.).

```tsx
import { Eye } from "lucide-react";

const components = { icons: { eye: Eye } };
```

A plugin registers these inside its admin-side `Provider` (see each block of `@monti-cms/blocks`, and `@monti-cms/ai`, for examples). A server layout
cannot pass components to the browser, so they are registered through a client provider, not the plugin definition.

## Properties panel

The properties panel on the right of the edit screen renders inputs from the collection definition. The input is chosen by field type: text, select, relation; a media field
(`fields.media`) is a media picker (a file upload when `accept: "file"`). Inputs are never swapped by field name or role.
If a registered input is chosen with `input`, that input wins. The core has no named inputs. Multiline text (`multiline: true`) is a multi-row box of
`rows` (default 2) rows (the old `input: "auto-summary"` becomes `multiline: true, rows: 3`).

`fieldInputs` accepts a component (replaces the whole input) or parts (`FieldInputParts`, keep the default input and change only some).
Parts can read the value being entered (`form`).

```tsx
const components = {
	fieldInputs: {
		// Use the fallback value as the hint text, and put the character count on the right of the label row
		"meta-title": { placeholder: ({ form }) => form.title, Aside: ({ value }) => <span>{String(value ?? "").length}</span> },
		// Only a switch in the label row, with no input row (`Input: null`)
		"hide-switch": { Input: null, Aside: HideSwitch },
	},
};
```

Each field or `layout` group `tab` creates a tab in the properties panel (a `Properties` tab if none; the group's `tab` takes precedence). A view field
(`fields.view({ view })`) renders in that place the screen registered under `fieldViews` of `CmsAdminComponentsProvider` (`{ name: ({ collection, form, entry }) => … }`).
If no screen is registered, nothing is rendered. A screen that renders a preview from a media ID
uses `MediaThumbnail` and `useMediaUrl` from `@monti-cms/admin/media` (the search preview in the SEO extension `@monti-cms/seo` is an example).
Dates and times are shown in the site config's `timeZone` and formatted by `admin.locale` (default `ko-KR`). The hint text of a relation input uses the target collection's
label (e.g. "Choose a post"). An entry of an item collection (`kind: "item"`) opens in a small form in the list. Places that point to several
collections, such as media usage, open that entry's cell with `<admin path>?collection=<collection>&open=<ID>`, and opening `<admin path>/entries/<ID>/edit` also
redirects there. Saved list column names that are no longer columns are dropped (old names are not guessed and remapped).

## Block edit screens

For a block added by the config's `blocks` or a block extension plugin (`editor.view: "node"`), the admin UI builds the editor node (`cms` + Pascal-case
name, e.g. `cmsNotice`), conversion, slash menu insertion and drag rules from the definition. You only need to supply the editing look.

- If you supply nothing, a directive block is a box holding the property inputs and body, and a code fence block is a code input with a preview.
- `blockEditors` replaces the property and body look inside the default frame; `blockViews` replaces the whole screen including the frame.
- Tools for building `blockViews` screens (reading and writing property values, child position, input panel, tool row, node name) are in `@monti-cms/admin/blocks`.
  The callout and tabs screens of `@monti-cms/blocks` are examples.

## Text marks

A block extension's text mark (`syntax.kind: "text"`, `editor.view: "mark"`, e.g. tooltip, code link and text color in `@monti-cms/blocks`) makes the admin
UI build the editor mark (`cms` + Pascal-case name, `addedMarkName("tooltip")` -> `cmsTooltip`) and the stored document conversion from the definition. The core
editor does not know mark names and renders only what an extension provides through `marks` (block name -> `EditorMarkExtension`) of `CmsAdminComponentsProvider`.

```tsx
import type { EditorMarkExtension } from "@monti-cms/admin/editor";

const note: EditorMarkExtension = {
	inclusive: false, // whether text typed at the end of the mark inherits it (default false)
	render: (attrs) => ({ class: "underline decoration-wavy" }), // HTML attributes to add to the span
	toolbar: { group: "format", priority: 3, Button: NoteButton, MenuItems: NoteMenuItems }, // format: after text marks, link: after the link
	bubble: { group: "link", order: -1, Button: NoteBubbleButton }, // bubble button when text is selected (before the link)
	detail: NoteDetail, // bubble content when the cursor is inside the mark (description, edit, remove)
	insertActions: [{ id: "note", title: "Note", description: "…", keywords: ["note"], run: (editor, range) => {} }], // slash menu
};
const components = { marks: { note } };
```

- Bubble buttons and content receive `{ editor, inCode, openPanel, closePanel, act }`. `openPanel({ label, size, content })` expands an
  input panel inside the bubble. To get the same look, use `BubbleButton`, `MarkTextForm`, `MarkTextPopover`,
  `removeInlineMark` and `allowsMark` from `@monti-cms/admin/editor`.
- In HTML it is `span[data-cms-mark="name"]` with `data-mark-<attribute>` for each attribute. The mark name in the stored document (CmsNode) is the block name,
  and only the attributes in the definition are kept (`markAttrsOf`).
- A mark whose attribute has `codeAnchor: true` points to a code block line label (`CODE_ANCHOR_REF`). The code block's line menu "Link to text",
  the linking hint row, the hovered-line highlight (`data-code-ref`) and the broken-link indicator use this mark, and they are hidden when no such mark exists. The
  linking commands used in the bubble (`findAnchor`, `startLinkFromText`, `unlinkRef`) are in the same entry point.
- The character tooltip inside a code block (code fence comment `// @char Tooltip`) is a core code block feature, separate from the body tooltip (mark `codeTooltip`).
- The code block tools follow the site config `codeBlock` (`@monti-cms/core` README): `omitLineEffects` and `features` (`rules`, `fold`, `tooltip`, `textStyles`) hide line effects, regex rules, folding,
  the tooltip and bold, italic, strikethrough and underline from the line menu, the rules panel, the bubble, the toolbar and the shortcuts inside code, and `themes` and `languages` set the highlighting themes and the language list.
  A body that already uses a tool that is off still loads and saves unchanged, and its effects stay visible so they can be removed.

## Text checking (spelling, etc.)

The core has no checkers; it only renders the buttons, underlines and results window. When a site or extension builds a checker (a paid API, an npm package that runs in the browser,
etc.) and puts it in the extension point `textCheckers`, every checker that checks the text's language gets a toolbar button (name `label`, icon `icon`),
and results appear as wavy underlines, a results window and a list. If several extensions add checkers, all are collected. With no checkers, nothing is shown.
The Bareun checker is `@monti-cms/bareun`.

```tsx
"use client";
import { defineTextChecker } from "@monti-cms/core/client";
import type { CmsAdminComponents } from "@monti-cms/admin";

const myChecker = defineTextChecker({
	id: "my-words",
	label: "Banned words", // toolbar button name
	icon: "ban", // lucide name or component. Defaults to the spelling icon
	locales: ["ko"], // all languages if omitted
	limits: { maxChars: 10_000, maxSegments: 50 }, // split before sending if exceeded
	// auto: true, // when typing pauses, checks only changed paragraphs automatically (off by default)
	check: async (segments, { signal }) => [
		// { segmentId, start, end, message, suggestions: [], severity: "error" | "warning" | "info", ruleId?, category?, source?, url? }
	],
});

const components: CmsAdminComponents = { textCheckers: [myChecker] };
```

- The unit of checking is one paragraph (a block holding text, such as a heading, list item or table cell): `{ id, text, locale }`. A result's `start` and `end` are
  UTF-16 positions within that paragraph (JS string indexes, `end` exclusive).
- Code blocks, formulas, code fence blocks and block attributes are not sent. Inline code and URLs are sent replaced by the single character `￼`, and results spanning that character
  are dropped. For links, only the text is sent.
- A checker button checks only the paragraphs overlapping the selection if there is one, otherwise the whole document, with that checker. Results appear as wavy underlines,
  and clicking an underline shows the explanation, replacement candidates and "Ignore". Clicking the number next to the button opens the results list. Editing within a result's range removes that result.
- Paragraphs with the same checker, language and text are not sent again (while the edit screen stays open). Re-checking or closing the screen aborts the in-flight request
  with `signal`.
- `auto: true` is off by default because paid or rate-limited APIs may cost money. When on, it sends only the paragraphs changed since opening, after typing pauses for 1.5 seconds.

### APIs that need a key

API keys are not kept in the browser. The browser sends `{ segments }` to a site route with `remoteTextChecker`, and the route calls the API with the key
and returns `{ issues }`. `textCheckRoute` checks the admin login and same origin and limits the request size (default 100 paragraphs, 20,000 characters).

```ts
// Admin component (browser)
import { remoteTextChecker } from "@monti-cms/core/client";
const checker = remoteTextChecker({ id: "bareun", label: "Bareun", locales: ["ko"], url: "/api/text-check" });

// app/api/text-check/route.ts (server)
import { textCheckRoute } from "@monti-cms/core/plugin/server";
export const POST = textCheckRoute({
	limits: { maxChars: 20_000 },
	check: async (segments, { signal }) => callProvider(segments, process.env.MY_API_KEY, signal), // TextIssue[]
});
```

### When wiring up a checker

- If the position unit differs, convert to UTF-16 on the checker side. Using byte (UTF-8), code point or sentence-based positions as is makes
  underlines drift after emoji or Hangul.
- Bareun: pass `encoding_type: UTF16` in the request and `begin_offset` and `length` can be used as is. Expand nested results (`nested`).
- Position-based APIs such as LanguageTool and Yahoo: when sending paragraphs joined together, split the returned positions back per paragraph. Match request size and per-minute call limits
  with `limits` and the server route.
- textlint: use `range` (`[start, end]`) as is. Use `fix.text` as a candidate, but `fix.range` may be wider than the displayed range.
- hunspell family (nspell, typo-js): they work per word, so split words with something like `Intl.Segmenter({ granularity: "word" })`, check them and compute positions yourself.
  They do not check spacing or grammar.
- For checkers that return only the misspelled word without a position, find the word in the paragraph text to determine the position (in order if the same word appears several times).

`app/(admin)/studio/admin-components.tsx` in `examples/other-site` is an example of a small banned-word checker that runs in the browser.

The underline styles are included in `@monti-cms/admin/styles.css`.

## Plugin screens

The module that a plugin definition's `admin` loads provides `defineAdminPlugin()` (`@monti-cms/admin/plugins`) as its default export.

```ts
export default defineAdminPlugin({
	pages: { my: MyPage }, // <admin path>/my (default /admin/my, a client component). The admin UI handles the login check
	Provider: MyProvider, // wraps the whole admin UI. Inside it, add input and edit screen extensions with CmsAdminComponentsProvider
});
```

Edit screen extensions (`editorExtensions`) are hooks that add an element at the end of the toolbar, an action next to the block handle, and actions for the selection menu and slash menu. For the field side, body images, media and code blocks,
attach actions to the slots with `SlotRegistryProvider` (`@monti-cms/admin/slots`).

To build screens that look like the admin UI, use the extension kit `@monti-cms/admin/kit`. It contains parts such as buttons, input boxes, dialogs, menus and tables,
`cn`, the confirm dialog (`useConfirm`), the plugin screen frame (`AdminShell`), icon lookup (`useIconByName`), `useDebounced` and the entry form value types
(`EntryForm`, `EntryData`). Internal admin file paths (`ui/*`, `screens/*`) are not public.

| Entry point | Contents |
|---|---|
| `@monti-cms/admin` | Adding site components (`CmsAdminComponentsProvider`), properties panel and list cell types |
| `/next` | Admin layout and page (exported from the app route) |
| `/editor` | Editor extension helpers (bubble, slash menu, code block linking) |
| `/blocks` | Block edit screen helpers |
| `/plugins` | `defineAdminPlugin` |
| `/slots` | Attaching actions to screen slots |
| `/media` | Media picker and preview |
| `/api` | Calling the admin API (`cmsFetch`) |
| `/kit` | Parts and helpers for extensions |
| `/styles.css` | Admin styles |

## Styles

The admin UI's CSS has **Tailwind 4** as an optional peer requirement (it is not listed as a peer in `package.json`). Only apps that use the admin UI need Tailwind 4;
apps that use only the `@monti-cms/core` core and reading or public rendering do not. No prebuilt CSS is provided. The app's Tailwind generates the admin UI classes itself, so
the app must have `tailwindcss` and `@tailwindcss/postcss` (Tailwind 4), `tw-animate-css` and `@tailwindcss/typography`.

What `@monti-cms/admin/styles.css` provides (everything carries the `cms` prefix, so nothing collides with the app's names):

- **Color names.** `cms-*` colors such as `bg-cms-background`, `text-cms-muted-foreground` and `border-cms-border` (values come from `--cms-*` variables). The app's shadcn
  names (`bg-background`, etc.) and variables (`--background`, etc.) are left untouched. `--cms-*` apply only to documents that contain the admin UI.
- **Variants.** `cms-dark:` applies when `html` (or an ancestor) has `.dark` or `[data-theme="dark"]`; `cms-horizontal:` and `cms-vertical:` apply for Base UI's
  `data-orientation`. They are independent of the app's `dark` and `data-horizontal` definitions. Whatever theme mechanism the app uses (class or `data-theme`), the admin UI's
  dark theme follows it.
- **Everything else.** Tailwind class discovery for the published bundle (`@source`), default border and focus outline colors, and the admin document's radius (`--radius*`) values (these use Tailwind's default
  names, so they change only in documents that contain the admin UI).

`CmsAdminLayout` has optional props to turn off the providers the admin UI adds. If the site already has a `next-themes` provider or a `sonner` `Toaster`, turn them off to avoid duplicates.

```tsx
<CmsAdminLayout themeProvider={false} toaster={false}>
	{children}
</CmsAdminLayout>
```

- `themeProvider` (default `true`): the admin UI adds a `next-themes` provider (`attribute="class"`) that keeps its theme under its own storage key, `monti-admin-theme`, so switching the
  theme in the admin does not change the site's theme. When leaving the admin, the provider puts the `dark` and `light` classes and `color-scheme` on `html` back the way they were before the admin mounted
  (the site's own theme is left alone, and public screens in the same root layout do not stay dark). When off, the admin follows the
  `.dark` or `[data-theme="dark"]` that the site's provider puts on `html`, and the theme toggle in the admin changes the site's theme.
- `themeStorageKey` (default `monti-admin-theme`): the `localStorage` key for the admin's theme, used only with `themeProvider`.
- `toaster` (default `true`): the admin UI adds `sonner`'s `Toaster`. When off, admin notifications appear in the site's `Toaster` (when using the same `sonner`).

## Development

```bash
pnpm --filter @monti-cms/admin test:run        # example blog config + other-site config
pnpm --filter @monti-cms/admin test:other-site # other-site config only (`../core/test/other-site.config.ts`)
```

Screen tests also run with a site config different from the reference blog (`vitest.othersite.config.ts`, core README "Development"). Do not write collection, field or block names and
labels in tests; read them from the config (e.g. `src/screens/__test__/any-site-screens.test.tsx`).
