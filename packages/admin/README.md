# @monti-cms/admin

English | [한국어](README.ko.md)

Admin UI for `@monti-cms/core`. Provides the list, editor (tiptap), media, trash, login and Settings screens (Settings holds the schema editor at `/admin/settings/<tab>`; templates, the event log and plugin pages have their own addresses).
It is framework-neutral: it imports nothing from Next.js and reaches the router through an adapter it is given (see "Router adapter"). Next.js (App Router) is the supported host for now, through `@monti-cms/nextjs`.
Plugins (e.g. `@monti-cms/ai`) add Tools pages, field-side buttons and edit screen actions.
The screens only call the core's admin API (`/api/monti/v1/*`). You can also skip installing it and build your own screens against the same API.

## Setup

For installation, routes and styles, follow "Install in an empty Next app" in the `@monti-cms/core` README (`monti init` generates the admin route and style lines). The admin route files use `CmsAdminLayout` and `CmsAdminPage` of `@monti-cms/nextjs/admin`.

- **Admin path.** Defaults to `/admin`; change it with the site config's `admin.path` (e.g. `/studio`). The app's admin route folder
  (`app/studio/[[...path]]/page.tsx` and `layout.tsx`) must use the same path. Links inside screens, the login redirect (`<admin path>/login`) and
  plugin screen URLs follow this path. Screen code builds URLs with `site.adminHref("/media")` and `site.adminEntryEditHref(id)` of the site it gets from `useSite()` (`@monti-cms/admin`).
  The admin API (`/api/monti/v1`) does not change.
- **View site.** The external-link icon button next to the site name in the sidebar header (tooltip `View site`) opens `site.home` (default `/`). If the admin UI is on a different host, give a full URL.
- **Preview.** `Preview` on the edit screen appends the public path to `site.previewPath` and passes the language as `site.previewLocaleParam` (default
  `?locale=`). The URL in the search preview follows `site.localePrefix`.

## Adding site components

Field inputs, block edit screens and code fence previews are added by extensions, and the site can add to or override them (e.g. the block extension's Mermaid and chart provide a default
preview). The site adds its own through a plugin of its own: the plugin names an admin side, and the admin loads it (there is no separate file in `app/`). The admin side **declares** what it adds,
`defineAdminPlugin({ components })`, and the admin applies it; there is no provider to write. If the site's entry has the same name as an extension's, the site's wins (a later plugin wins).

```ts
// plugins/site-admin/index.ts
import { definePlugin } from "@monti-cms/core";

export const siteAdmin = () => definePlugin({ name: "site-admin", admin: () => import("./admin") });
```

```tsx
// plugins/site-admin/admin.tsx: the default export is the admin side
"use client";
import { defineAdminPlugin } from "@monti-cms/admin";

export default defineAdminPlugin({
	components: {
		fencePreviews: { chart: () => import("./chart").then((m) => m.Chart) }, // ({ source }) => ReactNode
		fieldInputs: { color: ColorInput }, // renders fields with fields.text({ input: "color" }) using this input
		blockViews: { notice: NoticeView, image: SiteImageView }, // edit view of any block, the core image, file and math included. A view takes no props: it calls useBlockEditor()
	},
});
```

Then list `siteAdmin()` in `plugins` of `monti.config.ts`. `examples/blog/plugins/word-list` and `examples/blog/plugins/site-callout` are examples. A fence nobody registers shows its source as is.

- **Where the code may live.** The admin loads the module on the server and hands its declaration to the browser as it is. Make the module `"use client"` (the simplest: its components in it), or keep it a plain module whose components come from `"use client"` modules. A function written in a plain admin module cannot reach the browser and fails there.
- **Components that depend on the site.** Give `components` as a function of the site, `components: (site) => ({ … })`, when they come from the site config (the plugin's options, the admin language). It runs in the browser, with the site the admin shows.
- **Slots and providers.** `slots` attaches actions to the screen slots (`SlotSource`s, "Screen slots" below). `Provider` is for a plugin that needs a React context of its own, such as state its parts share; most need none.

### Icons

A block definition's `editor.icon`, a plugin page's `icon`, a collection's `icon` and a code line effect's `icon` are IBM Carbon icon names (`document`, `warning--alt`, `text--highlight`; `spark` is the assistant's ✦).
The admin package includes only the commonly used icons, so register other names with `icons` of the same `components`. Unknown names show a default icon
(puzzle, plug, etc.).

```tsx
import { View } from "@carbon/icons-react";

export default defineAdminPlugin({ components: { icons: { view: View } } });
```

Each block of `@monti-cms/blocks` and `@monti-cms/ai` declare theirs the same way.

## The body is a stored document

The editor works on the stored document (`StoredDocument`), not on text. The JSON document is the only source of a body: no notation (MDX or any other) is
involved in loading it into the editor or saving it from there.

- `CmsEditor` takes `doc` and calls `onChange(doc)` after every change, with the block ids the document gave its blocks. A `doc` that did not come from the editor itself
  replaces what it shows (the same words with other block ids or key order leave it alone). `storedToTiptap(doc)` and `tiptapToStored(json)` in `@monti-cms/admin/editor`
  convert directly. A node the editor has no edit view for, and a body that could not be read as a document (one `unparsed` node), is kept whole in a read-only box
  (`cmsOpaqueBlock`), so nothing is lost.
- `CmsEditor` takes `allowed` (the object form of a collection's `body`: `blocks`, `marks`, `headings`; the edit screen passes the collection's). It then offers and accepts only those (toolbar, slash and component menus, the text bubble, input rules, shortcuts, paste), while a body that already holds something else still opens and saves unchanged. See "Allowed blocks and marks per body" in the `@monti-cms/core` README.
- The edit screen's form holds the body as `form.doc` (the draft, the browser recovery copy and the conflict comparison all see the document, compared by what it says:
  block ids and key order do not count). Recovery copies saved before that, with the body as MDX text in `form.mdx`, still restore: they are kept as an `unparsed` document, and the source panel of the `mdx()` plugin (`@monti-cms/mdx`) reads them again when it is open.
- `DocPreview` (`@monti-cms/admin/editor`) is the read-only view of a document the translation screen shows the source in, and AI shows results in.
  On the translation screen the source column follows the block being written: the source block paired with the block under the cursor (by its source link, see core's "Source links") sits at the same height and both are marked; while you only scroll, the source follows the middle of the translation. Inside a callout, collapsible or quote it goes down to the inner block, and a collapsed box in the translation collapses its source box.

### Source panels

The source toggle at the end of the toolbar edits the body as text in some notation. The notation is a plugin's: the toggle is shown only when a **source panel** is registered, in the
same provider as the other site components (`useAdminComponents().sourcePanels`). With several registered, the first one is used.

```tsx
// what the `mdx()` plugin of @monti-cms/mdx registers for you:
const components = {
	sourcePanels: [{ format: "mdx", label: "MDX source", Panel: MdxPanel }],
	formats: { mdx: mdxFormat }, // the formats the browser can read and write (`BrowserFormat`), found with `useFormat("mdx")`
};
```

`Panel` receives `SourcePanelProps`: `doc` (the body), `onChange(doc, issues)` (the text changed: the document it reads as and what was found about the text; a text it cannot read goes back
as a document holding it in one `unparsed` node, with the findings in `issues`), `focusBlock` (the id of the block to bring the caret to, for a publish issue) and, as extras the screen needs,
`readOnly` and `onComposing(composing)` (a save waits for an IME composition to end). The panel parses in the browser, so a mistake shows as it is typed.
A `BrowserFormat` is a format with its context bound: `export(doc): string` and `import(text)` (`{ ok: true, doc, warnings }` or `{ ok: false, issues }`), both synchronous.
The admin has no panel of its own: the MDX source panel and the `mdx` browser format are provided by `@monti-cms/mdx` (`@monti-cms/mdx/admin`), registered by the admin provider of its `mdx()` plugin. Without that plugin there is no source toggle. The panel's messages are in the namespace `cms-mdx.source`.
`SOURCE_ERROR_ID` (`@monti-cms/admin`) is the id of the element a panel shows its findings in, and `useLinkPaths` (`@monti-cms/admin`) gives a panel the paths of entry links. `mdxBrowserFormat` is no longer exported by `@monti-cms/admin/editor`.

### Links to entries

A link to an entry holds only the entry's id, so the editor looks up where it goes: the link bubble and the link form show the entry's title and address (an entry that is gone, or cannot be looked
up, says so). Opening the link goes to the entry's page on the site when it is published, otherwise to the entry in the admin. An address typed in the link form replaces the entry.

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

Each `layout` group `tab` creates a tab in the properties panel (the first tab holds the groups with no `tab`; the fields a plugin places, such as the SEO fields, get a tab of their own). The groups are worked out by core (`site.panelGroupsOf`), and the fields tree of the Settings screen is drawn from the same groups. A view field
(`fields.view({ view })`) renders in that place the screen declared under `fieldViews` of a plugin's `components` (`{ name: ({ collection, form, entry }) => … }`). `form` is the entry as it is being edited, and `form.doc` is the live body (a stored document; `toPlainText(site, form.doc)` gives its text), so a computed value follows the typing; `entry` is what the server last saved. The [reading time recipe](../../docs/recipes/reading-time-field.md) is one.
If no screen is registered, nothing is rendered. A screen that renders a preview from a media ID
uses `MediaThumbnail` from `@monti-cms/admin/kit` (the search preview in the SEO extension `@monti-cms/seo` is an example).
Dates and times are shown in the site config's `timeZone` and formatted by `admin.locale` (default `ko-KR`). The hint text of a relation input uses the target collection's
label (e.g. "Choose a post"). An entry of an item collection (`kind: "item"`) opens in a small form in the list. Places that point to several
collections, such as media usage, open that entry's cell with `<admin path>?collection=<collection>&open=<ID>`, and opening `<admin path>/entries/<ID>/edit` also
redirects there. Saved list column names that are no longer columns are dropped (old names are not guessed and remapped).

## Navigation and Settings

The sidebar has five parts: **Content** (each collection, then Media; a collection that has folders opens them as a tree under it while it is the open one), **Writing** (Templates, then the plugin pages whose `nav` item has `group: "writing"`, such as AI), **Site** (Data, API keys, the Event log, then the other plugin pages, e.g. Git sync; collapsed by default, remembered per browser, and open whenever one of its screens is; while collapsed its header carries the failed-delivery count), **Trash** with its count, and a footer with **Settings** and the theme toggle. Every screen has its own address:

| Screen | Address | Contents |
|---|---|---|
| Site, Languages, Collections, File, Admin | `<admin path>/settings` (opens the Site tab; `site`, `locales`, `collections`, `file`, `admin`) | Settings, the schema editor (below). The draft is shared by these tabs and survives moving to another tab. |
| API keys | `<admin path>/api-keys` | The central key store: a row per named key with its masked tail and the places that use it; add, rename, replace the value, delete (a key in use asks first and lists what stops working). Keys are encrypted with the server `secret`; values never come back to the browser. Keys a plugin declares it needs (`keySlots`, such as the spell checker's) get a row each: empty ones offer "Add a key" (pick a saved key or enter a new one), assigned ones show in the key's "in use" line and are cleared from its row menu. AI connections and git sync pick a saved key or enter a new one (saved here, in the same request) in their own forms. |
| Templates | `<admin path>/templates` | Body templates (a 404 when `admin.templates` is `false`). |
| Event log | `<admin path>/events` | Event deliveries. |
| One per plugin page | `<admin path>/tools/<path>` | A plugin's `nav` item and `pages` entry (e.g. `ai`, `git-sync`). |

`<admin path>/settings` goes to the first tab.

## Schema screen

`<admin path>/settings/collections` (sidebar: Settings > Collections; the editor also spans the Site, Languages, File and Admin tabs) rewrites `monti.schema.ts` on the development server while that file is plain data (the `defineSchema` import and `export default defineSchema({ ... })`, nothing else). It is read-only everywhere else, and for a file that has code in it (an import, a spread, a call), with the reason. Saving writes the whole file again, so comments in it are dropped (the screen says so). It is the screen of the `GET/PUT /api/monti/v1/schema` and `POST /api/monti/v1/schema/preview` routes of the core (see "Editing the schema in the admin" in the `@monti-cms/core` README for who may write, the order of a save and how the running instance reloads).

- **Collections**: label, icon, kind, public address, body, and the allowed blocks, marks and heading levels (a switch per list: off allows everything, on shows a checkbox per name the site knows). Fields of every kind open in place: name, kind, label, help text, required, languages, the options of the kind (text length and rows, a slug's source, a relation's target, media kind, a back link's relation, a view's name), the options of a select with their labels, default and order, and the dependent fields of each choice of a conditional field. Fields are reordered by dragging their handle (from the keyboard too: Space, the arrow keys, Space) and can be removed; a field renamed here keeps the layout, list columns and slug source that name it. Layout groups (title, tab, collapsed, fields in order) and list columns are edited as ordered lists. A new field is text, a choice, media or a link to another collection, and picking the kind shows its settings at once; a link also shows its input as a preview. A choice can show other fields per option, a link to several entries can show on the other collection too, and turning on the public address adds a slug when there is none.
- **Locales**: the content locales (a saved locale's code is a stored value, so only new locales get a code), the default locale and the time zone.
- **File**: the parts of the file the screen does not edit (site, admin and seed settings, and the recorded `migrations`).
- **Review changes** opens a dialog before anything is written. It lists every change with the entries it touches and a sample of them as links to the entries, the problems of the edit with their JSON path, and, for each change that has more than one way to treat the stored values (a removed or renamed field, a removed option, a field that became required), the choices: keep the values, move them to the renamed field, delete them, change the removed option to another, fill empty entries. The default is the server's (a rename the writer made is offered as a rename; a delete is never picked when entries hold the value). **Save and apply** then writes the file, the types and the dev database, and reloads the page so the sidebar, forms and lists are drawn from the new schema.

A production server (or one whose schema file is not writable) answers 403 to the write routes, so the screen only shows the schema and says why it cannot be edited. The screen is usable at about 750 px wide: the collection list becomes a row above the editor, and forms use one column. Its text is in the `cms-admin.schema` message dictionary (`en`, `ko`) and can be overridden like any other.

## Block edit screens

For a block added by the config's `blocks` or a block extension plugin (`editor.view: "node"`), the admin UI builds the editor node (`cms` + Pascal-case
name, e.g. `cmsNotice`), conversion, slash menu insertion and drag rules from the definition. You only need to supply the editing look.

- If you supply nothing, a directive block is a box holding the property inputs and body, and a code fence block is a code input with a preview.
- `blockViews` is the one place a block's edit view is registered, for every block: the blocks you add and the core `image`, `file` and `math` blocks
  (register `blockViews.image` to redraw images). A view replaces the default view of that block, frame included.
- A view takes no props. It reads and writes its block with `useBlockEditor()`, draws the editable nested body of a container with `<Content />` and wraps itself in
  `<BlockFrame>`, all from `@monti-cms/admin`. No Tiptap or ProseMirror types are needed. The UI parts (`ContainerToolbar`, `ToolbarButton`, `BlockSettings`, `AttributeInput`) are there too.
  The callout, tabs, columns, collapsible and code explorer screens of `@monti-cms/blocks` are examples.
- `blockEditors` and `CustomBlockEditorProps` are removed. `content` becomes `<Content />`, `values` and `setValue` become `useBlockEditor().values` and `.setValue`,
  and `editable` and `selected` are fields of the same object. Wrap the result in `<BlockFrame>`, which the old default frame did for you.
  The edit-view helpers that took Tiptap types (`useContainerValues`, `valuesOf`, `withValue`, `childPos`, `focusInside`, `selectContainer`, `useSelectedChildIndex`, `useEditorEditable`)
  are no longer exported; `useBlockEditor()` covers them. `BLOCK_NODE_VIEWS` is now `BLOCK_NODES` (the old name is removed).

```tsx
import { BlockFrame, Content, useBlockEditor } from "@monti-cms/admin";

function NoticeView() {
	const block = useBlockEditor<{ level: string }>();
	return (
		<BlockFrame>
			<button type="button" contentEditable={false} onClick={() => block.setValue("level", "warn")}>
				{block.values.level}
			</button>
			<Content />
		</BlockFrame>
	);
}
```

## Admin events

A plugin's admin side reacts to what happens in the admin with `on`, written by target and event like `on` on the server:
`defineAdminPlugin({ on: { editor: { imageInserted: [fillAltText] } } })` (the types are `AdminEvents`, `ImageInserted` and `ImageInsertedEvent`). Admin events are
past tense: they come after the fact and never block it. Each takes a list of independent subscribers, in plugin order, and a subscriber that fails shows a short
notice without touching the action or the others. A subscriber is a client function, so it goes in the plugin's `"use client"` admin module.

| Event | When | What the subscriber gets |
|---|---|---|
| `editor.imageInserted` | An image went into the body. Drop, paste, the slash menu and the toolbar all insert through the image dialog, so it fires for each | `{ image: { mediaId?, src?, alt, caption, decorative }, around, site, signal, fill }` |

The image is in at once and shows "Writing the image text…" while any subscriber runs. `fill({ alt?, caption? })` writes a field only while it is still empty
and the person has not typed in it since the insert (and no alt text into a decorative image), and writes nothing once the image was removed, when `signal` is
aborted too. It returns whether it wrote anything. While a plugin subscribes, the image dialog lets the alt text be left empty. `ai({ autoImageText: true })` of
`@monti-cms/ai` is one subscriber, and the [image alt recipe](../../docs/recipes/image-alt.md) is a small one of your own.

## Text marks

A block extension's text mark (`syntax.kind: "text"`, `editor.view: "mark"`, e.g. tooltip, code link and text color in `@monti-cms/blocks`) makes the admin
UI build the editor mark (`cms` + Pascal-case name, `addedMarkName("tooltip")` -> `cmsTooltip`) and the stored document conversion from the definition. The core
editor does not know mark names and renders only what an extension provides through `marks` (block name -> `EditorMarkExtension`) of its `components`.

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
- In HTML it is `span[data-monti-mark="name"]` with `data-mark-<attribute>` for each attribute. The mark name in the stored document (CmsNode) is the block name,
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
The Bareun checker is `@monti-cms/bareun`, a plugin you list in `plugins` of `monti.config.ts`. Your own checkers are registered through a plugin's admin side (see "Adding site components").

```tsx
"use client";
import { defineTextChecker } from "@monti-cms/core";
import type { AdminComponents } from "@monti-cms/admin";

const myChecker = defineTextChecker({
	id: "my-words",
	label: "Banned words", // toolbar button name
	icon: "flag", // Carbon icon name or component. Defaults to the spelling icon
	locales: ["ko"], // all languages if omitted
	limits: { maxChars: 10_000, maxSegments: 50 }, // split before sending if exceeded
	// auto: true, // when typing pauses, checks only changed paragraphs automatically (off by default)
	check: async (segments, { signal }) => [
		// { segmentId, start, end, message, suggestions: [], severity: "error" | "warning" | "info", ruleId?, category?, source?, url? }
	],
});

const components: AdminComponents = { textCheckers: [myChecker] };
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
// Admin side of a plugin (browser)
import { remoteTextChecker } from "@monti-cms/core";
const checker = remoteTextChecker({ id: "bareun", label: "Bareun", locales: ["ko"], url: "/api/text-check" });

// app/api/text-check/route.ts (server)
import { textCheckRoute } from "@monti-cms/core/server";
import { cms } from "@/monti.config";
export const POST = textCheckRoute({
	cms, // a route file of the app names its instance for the admin check
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

`plugins/word-list` in `examples/blog` is an example of a small banned-word checker that runs in the browser, registered as a plugin (`index.ts`, and `admin.tsx` with the checker and its declaration).

The underline styles are included in `@monti-cms/admin/styles.css`.

## Plugin screens

The module that a plugin definition's `admin` loads provides `defineAdminPlugin()` (`@monti-cms/admin`) as its default export.

```ts
export default defineAdminPlugin({
	pages: { my: MyPage }, // the page of the `nav` item "my": <admin path>/tools/my (default /admin/tools/my, a client component). The admin UI handles the login check
	components: { fieldViews: { "my-view": MyView } }, // field inputs and views, block views, marks, editor extensions, text checkers, icons, ... ("Adding site components")
	slots: [mySlotSource], // actions on the screen slots
	// Provider: MyProvider, // only for a plugin that needs a React context of its own
});
```

A page is a client component and shows as an item of the sidebar's Site group (or Writing, per `group`): the plugin definition's `nav` item (`{ path: "my", label, icon, group }`; `group` is `"writing"` or `"site"`, default `"site"`) names it, and the page draws only its body (the admin already provides the sidebar and the title). `PageActions` (`@monti-cms/admin/kit`) puts the page's one primary action on the right of the title bar. It calls the plugin's API with `useAdminFetch()` (`@monti-cms/admin`): `adminFetch("/v1/<plugin>/<route>", init)` takes the path after `/api/monti` and throws a `CmsApiError` whose `message` is the text to show. The site of the admin gives the language of that text and stops a write from the settings screen's preview. Outside a component, `adminFetch(site, path, init)` takes the site itself:

```tsx
"use client";
import { useAdminFetch } from "@monti-cms/admin";
import { useQuery } from "@tanstack/react-query";

export function StatsPage() {
	const adminFetch = useAdminFetch();
	const stats = useQuery({ queryKey: ["post-stats"], queryFn: ({ signal }) => adminFetch<{ published: number }>("/v1/post-stats/summary", { signal }) });
	return <div>{stats.data?.published}</div>;
}
```

The route it calls is a plugin route (`adminRoute`, "Plugins" in the `@monti-cms/core` README). The [admin page recipe](../../docs/recipes/admin-page.md) is the whole plugin; the [custom block recipe](../../docs/recipes/custom-block.md) is a block with an editor view.

Edit screen extensions (`editorExtensions`) are hooks that add an element at the end of the toolbar, an action next to the block handle, and actions for the selection menu and slash menu. For the field side, body images, media and code blocks,
attach actions to the slots with `slots` of `defineAdminPlugin` (the `SlotSource` type and the slot parts are in `@monti-cms/admin/slots`).

To build screens that look like the admin UI, use the extension kit `@monti-cms/admin/kit`. It contains parts such as buttons, input boxes, dialogs, menus and tables,
`cn`, the confirm dialog (`useConfirm`) and the unsaved-changes guard (`useUnsavedGuard`), the title bar actions (`PageActions`),
the list-and-editor layout (`MasterDetail`, `ListPane`, `ListRow`), the edit-form pieces (`useDraftEditor`, `EditorFooter`), the status pieces (`Count`,
`Banner`, `LoadErrorAlert`, `FormFieldError`), `commonMessages` (Save, Cancel, Retry, ...), `useDebounced`, the media preview (`MediaThumbnail`) and the entry form value types
(`EntryForm`, `EntryData`). Only what the Monti packages and the examples use is exported; a part that is missing is added when an extension needs it. Colors come from the `--monti-success`, `--monti-warning` and `--monti-destructive` tokens (with `-soft` and `-foreground`), never from raw color classes.
Internal admin file paths (`ui/*`, `screens/*`) are not public.

| Entry point | Contents |
|---|---|
| `@monti-cms/admin` | What a plugin's admin code needs: `defineAdminPlugin` (`pages`, `components`, `slots`, `statusItems`, `panel`), the component types (`FieldViewProps`, `AdminComponents`, ...), the admin API (`useAdminFetch`, `adminFetch`, `CmsApiError`, `errorText`, `isConflict`, `useCmsMutation`), a block's edit view (`useBlockEditor`, `BlockFrame`, `Content`, `ContainerToolbar`, `ToolbarButton`, `BlockSettings`, `AttributeInput`), the editor hooks (`useField`, `useEntryEditor`, ...; experimental) and the site as admin code reads it (`useSite`, `useTranslator`, `toPlainText`, `Site`, ..., the same values as `@monti-cms/core/site`). A plugin's admin code needs only this entry point, and `/kit` for screen parts |
| `/host` | The framework-neutral admin layout and page (`AdminLayout`, `AdminPage`, `adminMetadata`) and the `AdminServer` type, which a host package such as `@monti-cms/nextjs` mounts |
| `/router` | The router adapter: `AdminRouterProvider`, the `AdminRouter` type, `AdminLink`, `useAdminRouter`, `useAdminPathname`, `useAdminSearchParams` |
| `/editor` | The stored document and the editor (`CmsEditor`, `storedToTiptap`, `tiptapToStored`, `DocPreview`), editor extension helpers (bubble, slash menu, code block linking) |
| `/slots` | Attaching actions to screen slots |
| `/kit` | Parts and helpers for extensions |
| `/styles.css` | Admin styles (prebuilt, no Tailwind needed in the app) |

### Status bar

Every admin screen ends with a plain status bar (24px, the sidebar's background, a hairline on top). Core and plugins contribute items; the rule is that an item shows only changing state that leads somewhere when clicked, and renders nothing when there is nothing to say. Core ships the save state of the editor ("Draft · Saved 2 min ago", click to save), the language, the character count and reading time of the body (characters without whitespace, about 500 a minute, at least 1), whether the saved draft is ready to publish ("Ready to publish", "2 to fix before publishing"; from `POST /api/monti/v1/entries/:id/check`, rerun when the entry opens and after each save, and a refused publish opens its popup), failed event deliveries (links to the event log) and the entry count of lists.

A plugin adds items with `statusItems` of `defineAdminPlugin`, by name. Each item declares its group (`align: "start"` is the left group, `"end"` the right one) and its `order` (ascending; the core items use 10 to 80 on the left and 10 on the right), and a component that renders a `StatusBarItem` or `null`:

```tsx
"use client";
import { StatusBarItem, useStatusBarContext } from "@monti-cms/admin/kit";

function DraftsStatus() {
	const { screen, collection } = useStatusBarContext(); // "list" | "entry" | "media" | "settings" | "tools" | ...
	const drafts = useDrafts(collection); // your own query
	if (screen !== "list" || !drafts) return null; // null hides the item, with no gap
	return <StatusBarItem tone="warning" href="/admin?status=draft" title="Open the drafts">{drafts} drafts</StatusBarItem>;
}

export default defineAdminPlugin({ statusItems: { drafts: { align: "start", order: 100, Component: DraftsStatus } } });
```

`StatusBarItem` takes `icon`, `tone` (`default`, `warning`, `danger`), at most one of `href` (a link inside the admin), `onClick` (a button) or `popover` (a popup; with `open` and `onOpenChange` the caller controls it), a `title` (tooltip) and its text as children. `useStatusBarContext()` returns the screen kind, the `collection`, the `count` of a list, and on the editor the `entryId`, the `locale` and an `EditorStatus` (save state, time of the last save, the size of the body, the browser copy on offer, the translations, and the findings of the text checkers with a way to each). Give a function of the site (`statusItems: (site) => ({ ... })`) when the items depend on the site config; the components come from a `"use client"` module. On narrow screens the bar hides its `end` items first and never wraps.

With `popover`, clicking the item (or Enter and Space) opens a popup above it, lined up with the item's left edge in the `start` group and its right edge in the `end` group; Escape closes it and the focus returns to the item. The popup is 320px wide and scrolls when the screen is short. Build its content from `StatusPopoverHeader` (a title and an optional action on the right, `{ label, onClick, keepOpen? }` or `{ label, href, newTab }`; `keepOpen` leaves the popup open after the action) and `StatusPopoverRow` (a `label` on the left and a `value` in mono on the right; `href` makes it a link, `onClick` a button, and both close the popup). Core uses popups for the save state (status, last save, Save now, Retry, Sign in, restoring the browser copy), the language (the translations and where each stands), the body counts, what to fix before publishing (each problem as a plain to-do that goes to its field or block, and Check again), and the latest failed deliveries (Retry all, the event log):

```tsx
function DraftsStatus() {
	const { collection } = useStatusBarContext();
	const drafts = useDrafts(collection); // your own query: [{ id, title }]
	if (!drafts.length) return null;
	return (
		<StatusBarItem
			tone="warning"
			title="Show the drafts"
			popover={
				<>
					<StatusPopoverHeader title="Drafts" action={{ label: "Open all", href: "/admin?status=draft" }} />
					{drafts.map((draft) => (
						<StatusPopoverRow key={draft.id} label={draft.title} href={`/admin/entries/${draft.id}`} />
					))}
				</>
			}
		>
			{drafts.length} drafts
		</StatusBarItem>
	);
}
```

### Side panel

A plugin adds one panel to the right of every screen, the entry editor included, with `panel` of `defineAdminPlugin`: a `label`, an `icon` and a `Component`. The admin draws a button for it in the header of each screen, opens it as a resizable pane (a sheet below 1280px; Ctrl or Cmd with `.` also opens and closes it) and remembers in this browser whether it is open and how wide. The admin shows one panel for now: with several, the plugin registered last wins. Give a function of the site (`panel: (site) => ({ ... })`) when the label depends on the site config; it and the component come from a `"use client"` module. The component draws its own frame (`SidePanelFrame` from `/kit` has the header, a scrolling body and a pinned footer) and gets `onClose` to close the panel.

```tsx
export default defineAdminPlugin({ panel: { label: "Notes", icon: StickyNote, Component: NotesPanel } });
```

The component reads where the admin is with `useScreenContext()`: `screen` (`entries`, `entry`, `media`, `settings` or `other`), the `collection`, the open entry's `entryId` and, on the entry list, the `selectedIds` of the picked rows (empty while none is). On the entry editor, `useOpenEditor()` also returns the open editor: `readEntry()` gives the entry as the form holds it, unsaved changes included, and `readSelection()` gives the selected text and the block at the cursor with its block id. Both read the editor at the time of the call. Everywhere else `useOpenEditor()` is `null`.

### Router adapter

The screens and the hooks never import a framework. Everything they need from the router comes from one object, an `AdminRouter`, that a host package gives to `AdminRouterProvider` (`@monti-cms/admin/router`):

| Member | Meaning |
|---|---|
| `Link` | A component for a link to an address inside the site (`<a>` props, a string `href`). Client-side navigation where the framework has it |
| `navigate(href, { scroll? })` | Goes to the address and adds a history entry |
| `replace(href, { scroll? })` | Goes to the address in place of the current history entry. A list that only changes its query passes `scroll: false` |
| `usePathname()` | Hook: the path of the current address |
| `useSearchParams()` | Hook: the query of the current address (read-only `URLSearchParams`) |

Inside the admin, use `AdminLink`, `useAdminRouter()`, `useAdminPathname()` and `useAdminSearchParams()` from the same entry point; they throw a clear error outside the provider. Plugin screens use them too (the AI plugin reads the path this way).

The two things a server screen needs, a redirect and a 404, are an `AdminServer` (`{ redirect(href): never; notFound(): never }`) handed to `AdminPage` (`@monti-cms/admin/host`).
`@monti-cms/nextjs/admin` builds both from `next/link`, `next/navigation` and Next's `redirect` and `notFound`. A host for another framework supplies its own and renders `AdminLayout` inside `AdminRouterProvider`.
A test keeps the boundary: no source file of the admin may import `next/*`.

### Editor hooks (experimental)

The entry editor hooks (`useField`, `useEntryEditor` and their types) are experimental and may change in a minor release until the installed components have used them.
Its hooks return state and results only: they never show a toast, open a confirm dialog or navigate, so a site can draw its own UI on them.
The default admin UI is built on the same hooks. Commands return an `EditorResult` (`{ ok: true, value }` or `{ ok: false, error }`) instead of throwing
for expected failures, and `EditorError.code` (`conflict`, `session_expired`, `offline`, `validation`, `invalid_state`, ...) is what to branch on.

`useSlotActions(request)` gives the actions attached to one screen slot with their run state (`idle`, `asking`, `running`, `done`, `error`),
`run`, `cancel` and `apply`. Run state is shared by every hook instance with the same slot, target, collection and scope,
and it survives the component unmounting. `useSlot` (`@monti-cms/admin/slots`) is the default button and panel on top of it.

`useField(name)` gives one form field's `value`, `setValue`, `error` / `errors`, `readOnly` (`readOnlyReason`: `disabled` or `locked`), the ids that link
the label, the input and the error text (`ids`, `inputProps`), and the field's `slotRequest` to pass to `useSlotActions`. It must be used below an
`EntryFormProvider`; the entry editor's properties panel and the record panel provide one, and a screen that keeps its own form state can provide its own
(`collection`, `form`, `setForm`, `issues`, `disabled`, `entryId`, `locale`, `entry`, `locked`). A component re-renders only when its own field changes,
so typing in one field does not re-render the others. The default field UI (`SchemaFields`) is built on the same hook.

`useBlockEditor()` is the hook of a block view (a component registered in `blockViews`; it throws anywhere else). It returns the block's attribute `values` with
`setValue` and `setValues` (one undo step), the `source` of a block written as code (math, code fences) with `setSource`, `editable`, `selected` and `focusedChild`
(the child the cursor is in), `select`, `focus({ child, at })`, `remove` and `textAround` (text around the block, for AI context). A container's `children`
are managed with `addChild`, `removeChild`, `moveChild` and `setChildValue`; they respect `definition.children.min` and `max` and return an `EditorResult` with
code `limit` when a bound would be broken (`read_only` while the editor is locked). `transact(tx => ...)` groups several edits, which read the live document, into one document change
and so one undo step, for example renaming a tab and the default tab that points at it. `raw` (`{ editor, node, getPos }`) is the one escape hatch and the only place Tiptap and
ProseMirror types appear; it is not stable. `<Content />` renders the editable nested body (with `visibleChild` to show one child, such as the open tab) and `<BlockFrame />`
is the outer element with the selected ring and hover scope. The child blocks sit inside the first element of `[data-monti-block-content]`.

`useEntryEditor(options)` is the entry editor without its screen: load, a local recovery copy, explicit server save, publish, status changes
(archive, trash, restore), and recovery and conflict state. **It is not a server autosave.** While editing, only a recovery copy is kept in the browser
(IndexedDB, written after input pauses, never sent to the server); the server draft changes only when `save()`, `publish()` or a status change runs, and
`saveStatus` (`saved`, `dirty`, `saving`, `local-only`, `conflict`, ...) says what the server has. State: `load` (`loading`, `ready`, `error`, or `redirect` for an item
collection, which the UI follows: the hook never navigates), `entry`, `form`, `saveStatus`, `saveError`, `hasUnsavedChanges`, `publishIssues`, `recovery` (a browser copy
found on open) and `conflict` (someone saved first). Commands: `setForm`, `setBody` (the body, a stored document), `save`, `retry`, `publish`, `changeStatus`, `duplicate`, `deletePermanently`,
`restoreRecovery` / `discardRecovery`, and `overwriteWithMine` / `reload` for a conflict, which resolve it in place without reloading the page. Wrap the UI in
`EntryEditorProvider` (it provides the `EntryFormProvider` that `useField` reads) and read the editor below it with `useEntryEditorContext()` or, to re-render for one
value only, `useEntryEditorContext((editor) => editor.saveStatus)`. The server calls and the recovery store can be replaced (`client`, `recoveryStore` options) for tests.
The default entry editor (`EntryEditorShell`) is built on it and keeps the toasts, confirm dialogs and navigation.

```tsx
const editor = useEntryEditor({ adminId, target: { mode: "edit", entryId } });
if (editor.load.status !== "ready") return null;
return (
	<EntryEditorProvider editor={editor}>
		<TitleInput /> {/* useField("title") */}
		<button onClick={async () => { const saved = await editor.save(); if (!saved.ok) alert(saved.error.message); }}>Save</button>
		{editor.conflict && <button onClick={() => void editor.overwriteWithMine()}>Overwrite with mine</button>}
	</EntryEditorProvider>
);
```

## Data layer and remembered state

Screens never call `fetch` themselves. Each resource has one module in `src/api/` (`entries`, `media`, `folders`, `templates`, `events`, `api-keys`, `schema`, `preferences`) that exports typed request functions and one query-key factory (`entriesKeys`, `mediaKeys`, ...). Plugin pages follow the same shape with an `api.ts` of their own. A write goes through `useCmsMutation({ fn, success, failure, invalidate, optimistic })` (`@monti-cms/admin`), which owns the toast, the optimistic update and its rollback, and the invalidation. `errorText(site, error, fallback)` is the one place an error becomes text, and `isConflict(error)` tells a stale write from other failures.

What a screen remembers lives in one of three places:

| Kind | Where | Read with |
| --- | --- | --- |
| Per device (panel widths, media grid or list, editor width, whether a pane is open) | the browser, `localStorage`, per site | `usePreference(name, codec, default)` |
| Per person (list columns, sort and page size of a collection) | the server, `/v1/preferences` | `api/preferences` |
| Per view (page, page size, filters, search) | the address | `useUrlState({ page: pageParam, ... })` |

## Styles

The admin UI's CSS is **prebuilt**: `@monti-cms/admin/styles.css` is compiled with Tailwind 4 when the package is built, so the app needs no Tailwind, `@tailwindcss/typography`
or `tw-animate-css` setup, and no `@source`, `@theme` or `@custom-variant` lines. Import it in the admin layout (only the admin pages then load it) or in any global CSS file:

```tsx
// app/admin/layout.tsx
import "@monti-cms/admin/styles.css";
```

An app that uses Tailwind 4 for its own public pages keeps doing so; the two do not interact.

How the bundle is built and confined (`scripts/build-styles.mjs`, run by `pnpm build`; the sources are in `styles/`):

- **Scoped.** Every selector sits under `:where(html:has(.monti-admin))`, a document that contains the admin UI (zero specificity, so a class keeps the strength it has in Tailwind). Popups are
  portaled to `body`, so the scope is the document, not the `.monti-admin` element. Public pages of the app, which never contain `.monti-admin`, are not affected.
- **Reset.** Tailwind's preflight is part of the bundle, but only under that scope, so it does not restyle the app's pages.
- **Names.** Every custom property the bundle declares starts with `--monti-` (Tailwind's own `--tw-*` became `--monti-tw-*`, and its theme is inlined), keyframes are `monti-*`, and no `@layer` is left in the file: unlayered rules beat the app's layered ones whatever order the stylesheets load in, so the app's own `.hidden`, `.prose` or reset (in its Tailwind `utilities` or `base` layer) cannot override the admin. The app's `--radius*` and theme variables are not defined or changed.
- **Math.** The KaTeX styles and fonts for the math preview are included (the fonts are copied to `dist/fonts` and linked relatively), so sites do not import KaTeX CSS for the admin.
- **Font.** Like Tailwind's preflight, the bundle falls back to the system sans-serif stack on `html` of an admin document. A font the app sets on `body` wins.
- **Bundled fonts.** The admin ships Pretendard (UI text, Korean and Latin; variable font in `unicode-range` slices, so a page downloads only the slices it shows) and IBM Plex Mono (code, field keys, slugs; latin, weights 400, 500, 600) in `dist/fonts`, linked relatively from `styles.css` with `font-display: swap`. Nothing is requested from a third-party server. They are registered as `Monti Pretendard` and `Monti Plex Mono`, so they never collide with a copy the site loads itself. Both are licensed under the SIL Open Font License 1.1; the license texts sit next to the files (`dist/fonts/pretendard/LICENSE.txt`, `dist/fonts/ibm-plex-mono/LICENSE.txt`).

What the bundle provides (everything carries the `monti` prefix, so nothing collides with the app's names):

- **The design system, and nothing else.** Color roles per property (`bg-monti-page`, `text-monti-muted`, `border-monti-default`, ...), type roles (`text-monti-caption`, ...), the spacing, radius, height and width scales,
  three shadows and four weights. Tailwind's own palette, text sizes, weights, shadows, letter spacing and line heights are left out of the bundle, so a class outside
  the system (`text-xs`, `bg-red-500`) compiles to nothing; a test names any such class in the admin or a first-party plugin. The app's shadcn names (`bg-background`, etc.) and variables
  (`--background`, etc.) are left untouched. `--monti-*` apply only to documents that contain the admin UI.
- **Variants.** `monti-dark:` applies when `html` (or an ancestor) has `.dark` or `[data-theme="dark"]`; `monti-horizontal:` and `monti-vertical:` apply for Base UI's
  `data-orientation`. They are independent of the app's `dark` and `data-horizontal` definitions. Whatever theme mechanism the app uses (class or `data-theme`), the admin UI's
  dark theme follows it.
- **Everything else.** Default border and focus outline colors, `color-scheme`, the thin scrollbar, and the focus outline color.

Plugins that add admin UI: the admin bundle also compiles the sources of the first-party plugins (`@monti-cms/ai`, `@monti-cms/blocks`, `@monti-cms/mdx`, `@monti-cms/seo`; see the `@source` lines of `styles/index.css`),
so the shared utilities, `prose`, the theme and the reset are defined in **one** file. That is the point: a second file that defined `.prose` again would load later and reset what the admin's dark variant had set.
`ai`, `mdx` and `seo` therefore ship no CSS. `@monti-cms/blocks/styles.css` holds only what utilities cannot say (the callout look, the text color rule, default variables) and is imported after the admin file.
A third-party plugin ships its own prebuilt CSS with classes of its own only (its own `monti-`prefixed names), never redefining shared utilities or `prose`. The confinement test fails when a selector is defined in two bundles.
The cost is that the admin file carries the classes of first-party plugins an app does not install (a few KB).

`CmsAdminLayout` (`@monti-cms/nextjs/admin`) takes the CMS instance (`cms`, exported by the app's `monti.config.ts`) and has optional props to turn off the providers the admin UI adds. If the site already has a `next-themes` provider, turn it off to avoid duplicates.

```tsx
<CmsAdminLayout cms={cms} themeProvider={false} toaster={false}>
	{children}
</CmsAdminLayout>
```

- `themeProvider` (default `true`): the admin UI adds a `next-themes` provider (`attribute="class"`) that keeps its theme under its own storage key, `monti-admin-theme`, so switching the
  theme in the admin does not change the site's theme. When leaving the admin, the provider puts the `dark` and `light` classes and `color-scheme` on `html` back the way they were before the admin mounted
  (the site's own theme is left alone, and public screens in the same root layout do not stay dark). When off, the admin follows the
  `.dark` or `[data-theme="dark"]` that the site's provider puts on `html`, and the theme toggle in the admin changes the site's theme.
- `themeStorageKey` (default `monti-admin-theme`): the `localStorage` key for the admin's theme, used only with `themeProvider`.
- `toaster` (default `true`): the admin UI adds its `Toaster` (from `@monti-cms/ui`). It has its own id, and the admin's toasts are addressed to it, so it can sit beside the site's own `sonner` `Toaster`: neither shows the other's toasts, and nothing is shown twice. Turn it off only if the page mounts that `Toaster` itself.

## Admin theme

The admin is built from one design system, `@monti-cms/ui` (names in its `styles/theme.css`, values in `styles/tokens.css`, both generated from its `tokens/tokens.json`). A site themes it by overriding its CSS custom properties; the names below are the public contract.

The defaults have zero specificity (`:where(...)`), so a plain `:root { ... }` rule of the site wins whatever order the stylesheets load in. The admin also sets `color-scheme` (`light`, and `dark` under
`.dark` or `[data-theme="dark"]` on `html`, the two ways it detects the dark theme), so `light-dark()` picks the right value for each mode and both modes fit in one line.

### Colors: scales, then roles

The names and values are the design system's own (`packages/ui/tokens/tokens.json`); `pnpm gen:tokens` writes `styles/tokens.css` and `styles/theme.css` from that file. Colors come in two tiers.

1. **Scales**, the raw values: `--monti-gray-1` to `--monti-gray-12` (1 paper, the page ground; 2 tool surfaces; 3 pill fill; 4 selected rows; 5 dividers; 6 borders of floating surfaces; 7 quiet strokes; 9 faint text;
   10 subtle text; 11 muted text; 12 ink), and four tones at two steps each: `--monti-success-*`, `--monti-warning-*`, `--monti-danger-*`, `--monti-proposal-*` with `3` soft fill and `11` text.
   There is no accent color. The proposal blue marks what an AI proposal adds and nothing else.
2. **Roles**, what the screens use. A role that points at a scale is declared once, so **overriding a scale step restyles every role on it, in both modes**:

| Property | Roles (`--monti-…`) | Classes |
| --- | --- | --- |
| Background | `bg-page` (lists, the editor, dialogs, menus), `bg-tool` (sidebar, panels, sheets, status bar), `bg-muted`, `bg-selected`, `bg-highlight`, `bg-block`, `bg-emphasis` (the black pill), `bg-{success,warning,danger,proposal}-muted`, `bg-danger-emphasis`, `bg-backdrop` | `bg-monti-page`, `bg-monti-tool`, … and `bg-monti-divider` (a 1px divider drawn as a box) |
| Text | `fg-default`, `fg-muted`, `fg-subtle`, `fg-faint` (placeholders and meta only), `fg-on-emphasis`, `fg-{success,warning,danger,proposal}` | `text-monti-default`, `text-monti-faint`, … (also `fill-`, `stroke-`, `caret-`) |
| Border | `border-muted` (list rows), `border-default` (section lines), `border-emphasis` (menus, dialogs), `border-strong` (link underlines), `border-contrast` (the ink rule) | `border-monti-muted`, `ring-monti-contrast`, `divide-monti-muted`, `decoration-monti-strong`; the text roles also color borders, rings and outlines (`border-monti-danger`) |
| Shadow | `shadow-floating` (menus, popovers), `shadow-overlay` (dialogs), `shadow-sheet` (sheets from the right edge); everything else is flat | `shadow-monti-floating`, `shadow-monti-overlay`, `shadow-monti-sheet` |

The roles with their own value in dark are `bg-page` and `bg-tool` (they swap: the tool ground is the darker one), `bg-highlight`, `bg-block`, `bg-backdrop`, `fg-on-emphasis` and the shadows. Colors are any CSS color.

```css
/* app/globals.css: any stylesheet of the site, loaded before or after @monti-cms/admin/styles.css */
:root {
	/* A greener paper: the page ground and every role on it follow. */
	--monti-gray-1: light-dark(#f8faf4, #121411);
	--monti-gray-2: light-dark(#f0f3ea, #171a15);
}
```

**A plain value applies to both modes.** A default has zero specificity in light *and* dark, so `:root { --monti-gray-12: #111; }` also replaces the dark default. Either write the value with `light-dark()`
as above, or set it again under `.dark, [data-theme="dark"]`.

### Type, spacing, radius and fonts

Type roles set size, line height, weight, letter spacing and font family together, as one class each. Sizes are px, so the root font-size of the site cannot rescale the admin. They are classes, not tokens a site overrides:

- `display` (36/45, 700): the entry title in the editor
- `page` (26/32, 700): a content page title
- `heading` (22/30, 700): headings in the editor body and dialog titles
- `reading` (17/30, 400): the editor body text
- `title` (16/22, 600): panel, sheet and settings section titles
- `body` (14/20, 400): default text, buttons, inputs, list row titles
- `label` (13/18, 500): tabs, filters, small buttons
- `note` (13/20, 400): secondary lines under a row title
- `caption` (12/16, 400): captions and timestamps
- `meta` (12/16, 400, mono): addresses, identifiers, counts, file sizes
- `micro` (11/14, 400, mono): field labels and group labels in menus and panels

| Token | What it sets |
| --- | --- |
| `--monti-space-2` … `--monti-space-48` | The spacing scale: 2, 4, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48 px (`gap-monti-12`, `px-monti-16`, `-mt-monti-4`) |
| `--monti-radius-sm`, `-md`, `-lg`, `-xl`, `-full` | Corner radius: 3 px (marks, checkboxes), 6 px (rows, tiles), 8 px (inline boxes), 12 px (floating surfaces), pill (`rounded-monti-md`) |
| `--monti-height-*`, `--monti-width-*`, `--monti-size-icon-*` | Heights of controls and bars (`h-monti-control-md` 36, `h-monti-header` 60, …), widths of columns, panels and sheets (`w-monti-sidebar` 232, `w-monti-sheet` 520, …) and icon sizes (`size-monti-icon-md` 16) |
| `--monti-font-sans`, `--monti-font-mono` | The admin's fonts: sans for the chrome (default: Pretendard, then a system stack with Korean fallbacks), mono for code, identifiers and source views (default: IBM Plex Mono, then a system monospace stack) |

**Centering is the font's job.** Pretendard's metrics already center Hangul and Latin text in the admin's controls, so no part nudges its text with padding. If you replace the font in `--monti-font-sans`, balance it where it is declared, with `ascent-override`, `descent-override` and `line-gap-override` in its `@font-face`, not with padding on a part. `pnpm test:visual:audit` (in `@monti-cms/ui`) reports every control whose text sits off center.

An extension builds with the kit's `Text`, `Heading` (a role and a tone) and `Stack` (a gap by the px step of the spacing scale: `gap={8}`) and the classes above.

### Reusing a shadcn theme

A site that has a shadcn theme can point the roles at it. shadcn swaps its variables under `.dark`, so the admin follows the site's dark mode with no second block:

```css
:root {
	--monti-bg-page: var(--background);
	--monti-bg-tool: var(--sidebar);
	--monti-bg-emphasis: var(--primary);
	--monti-fg-on-emphasis: var(--primary-foreground);
	--monti-fg-default: var(--foreground);
	--monti-fg-muted: var(--muted-foreground);
	--monti-bg-muted: var(--muted);
	--monti-bg-selected: var(--accent);
	--monti-border-muted: var(--border);
	--monti-border-default: var(--input);
	--monti-fg-danger: var(--destructive);
	--monti-radius-md: var(--radius);
}
```

shadcn has no warning or success colors, so those keep the admin's defaults. If the site's variables hold bare channels (the older `--primary: 222 47% 11%` style), wrap them: `hsl(var(--primary))`.

Blocks add `--monti-callout-*` and `--monti-chart-1` to `--monti-chart-5` (see `@monti-cms/blocks`). To check a theme, open the admin in light and dark. There is no config option: the CSS above is the
whole interface.

## Development

```bash
pnpm --filter @monti-cms/admin test:run        # example blog config + other-site config
pnpm --filter @monti-cms/admin test:other-site # other-site config only (`../core/test/other-site.config.ts`)
```

Screen tests also run with a site config different from the reference blog (`vitest.othersite.config.ts`, core README "Development"). Do not write collection, field or block names and
labels in tests; read them from the config (e.g. `src/screens/__test__/any-site-screens.test.tsx`).
