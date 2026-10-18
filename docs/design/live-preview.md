# Live preview plugin (design)

Status: proposal, not implemented. Package name: `@monti-cms/live-preview`.

Goal: while an admin edits an entry, the site's own preview page sits beside the editor and follows the unsaved text and fields, drawn by the site's real
components and blocks. It is a plugin; core and admin gain only generic pieces.

## Today

- The entry header's Preview button (`handlePreview` in `use-entry-lifecycle-commands.ts`) saves the draft, then opens `site.previewHref(collection, slug,
  locale)` in a new tab. The href is a path on the admin's own origin (`withBasePath`), because the admin is mounted inside the site's Next app.
- The site's preview route (`examples/blog/app/(site)/preview/[locale]/posts/[slug]/page.tsx`) calls `previewEntry(cms, params)`
  (`packages/nextjs/src/preview.ts`), which is `cms.read.getPreview` with the Next request attached. `getPreview` checks the admin session, loads the stored
  working copy by slug, merges a translation with its source's common values, and returns the same `ReadEntry` shape as a published read.
- The page then renders with server components: `PostView` (which also queries neighbouring posts) and `ArticleBody` (`CmsContent`, the site's block
  components, code highlighting). There is no client-side renderer of a document.
- The editor has no server autosave. Unsaved state lives in the form (`editor.form`) and in an IndexedDB recovery copy that is "never sent to the server"
  (`use-entry-editor.tsx`). The server draft changes only on `save()`, `publish()` or a status change.

So the preview shows the last saved draft, and seeing a change means Save, then switch tabs and reload.

## 1. How unsaved state reaches the preview

| Option | Real renderer | Latency | Security | Verdict |
| --- | --- | --- | --- | --- |
| A. `postMessage` the document into an iframe and render it on the client | No: the body is drawn by server components (`CmsContent`, highlighting, `PostView` queries). A client renderer would be a second copy of every block, and it would drift | ~1 frame | Same origin, nothing stored | Rejected |
| B. `postMessage` the document into the iframe, which sends it to a Server Action that renders | Partly: the site must restructure its page around an action, and layouts and page-level queries do not rerun | Round trip | Unsaved text still goes to the server, just without being stored | Rejected: invasive for the site |
| C. Save the real draft on every pause (server autosave) | Yes | Round trip | Fine | Rejected: changes Monti's explicit-save model, bumps versions, runs write hooks (`beforeValidate`, on-save plugins) and creates conflicts on every keystroke pause |
| **D. A scratch draft on the server, plus a refresh signal** | **Yes: the site's own route, `router.refresh()`** | **~0.5 to 1 s after a pause** | **Admin-only write and read, per user** | **Chosen** |

How D works:

1. The editor pane reads the form (`useEntryEditorContext`) and, about 400 ms after input pauses, sends `{ entryId, slug, metadata, doc, seq }` to the plugin's
   admin route (`access: "admin"`). The route stores it in the plugin's storage (`plugin.storage`), keyed by the signed-in user and the entry, and drops a write
   with an older `seq`. At most one request is in flight, and later changes are coalesced into the next one.
2. When the write returns, the pane sends `{ type: "monti:live-preview:refresh", seq }` to the iframe with `postMessage` (target origin `location.origin`).
3. The bridge in the preview page (a small client component) checks that the message comes from `window.parent` on the same origin and calls
   `router.refresh()` inside a transition. Next reruns the page's server components; scroll position and client state stay.
4. The page reads the entry with the plugin's helper, which returns the scratch draft for this admin and entry when the URL carries `?live=<entryId>`,
   rendered through the same path as `getPreview`. The bridge then reports `{ type: "monti:live-preview:rendered", seq }`, so the pane can show "up to date" and
   knows the page is set up.

Why this order of trade-offs: correctness against the real renderer is the point of a preview, and only server rendering of the site's own route gets it. The
cost is latency: a database write (local Postgres a few ms, Neon around 100 to 300 ms) plus one server render of the page. That is fine for "updates when you
pause", not for keystroke-level updates, and that is the right promise to make.

Security:

- The iframe and the admin share an origin (the preview href is a path of the site that hosts the admin). The message carries no content, only a sequence
  number, so a forged message can at most cause a refresh.
- The scratch route is an admin route with the same session and CSRF guard as the core admin API. A size limit equal to a save's applies.
- The helper reads a scratch draft only for the signed-in admin who wrote it (`getPreview`'s admin check, then owner check), so admins never see each other's
  unsaved text. For anyone else the page is the 404 it is today.
- A scratch draft older than the stored draft's `updatedAt` is ignored, so a later save always wins. The pane deletes its scratch when it closes or the
  entry is saved; a write also sweeps that user's scratch drafts older than a day.
- A site that sends `X-Frame-Options: DENY` or `frame-ancestors 'none'` on preview pages blocks the iframe; `SAMEORIGIN` works. The pane reports this as a
  setup problem (section 4).
- New: unsaved text now reaches the server while the pane is open. The pane says so the first time it opens (see question 3).

## 2. What core and admin expose

Kept to three generic pieces. Nothing here mentions live preview.

1. **core: read a given working copy.** `cms.read.getPreview` takes an optional `working: { slug?, metadata, doc }`. With it, the read uses those values in
   place of the stored working copy, and still does everything else: the admin check, the stored entry's identity and translation group, the translation
   merge, reference resolution and `format`. `previewEntry` passes it through unchanged. Other uses: previewing an AI rewrite or a template before applying it.
2. **admin: editor panes.** `AdminComponents.editorPanes?: readonly { id, label, icon, Pane }[]`. The entry editor shows a toggle per pane and renders the open
   pane in the right-hand region (section 3), inside `EntryEditorProvider`, so the pane reads the form with `useEntryEditorContext(selector)`. Other uses: an
   outline, comments, an assistant.
3. **admin: `useEntryEditorContext` stays public.** It is `@experimental` today. The plugin depends on reading `form.doc`, the form's metadata, `entry` and
   `saveStatus`; this design asks to keep at least those selectors stable.

Not proposed, on purpose:

- An admin event `editor.changed`. The pane already lives inside the editor and can read the form directly, debounced as it needs. An event earns its place
  when a subscriber without UI needs changes (question 4).
- A `previewEntry` that consults plugins on its own. It would need the request URL, which a page has and core does not, and it would make every preview page
  behave differently depending on installed plugins. The site calls the plugin's helper explicitly instead (section 4).

What the plugin itself ships, on existing APIs:

- server: one admin route (`routes`), its storage (`plugin.storage`), and an `on` subscriber that deletes the scratch draft when the entry is saved;
- admin: the pane (`components.editorPanes`);
- `@monti-cms/live-preview/next`: `livePreviewEntry(cms, params, searchParams)` and the client `LivePreviewBridge`.

## 3. Layout in the editor

Recommendation: a **resizable split on the right**, default 45% of the editor area.

- The right-hand region holds one pane at a time: the properties inspector or a plugin pane. Opening the preview hides the inspector; its toggle switches
  back. The inspector is narrow and the preview needs width; stacking both squeezes the editor.
- The translation screen keeps its source column on the left. Source, editor and preview side by side is three columns of text, too narrow below very wide
  screens. Below 1920 px, opening the preview closes the source column and the other way round, the same way a narrow window closes the source column today
  (`narrowClosedSourcePane`). At 1920 px and wider, all three may stay open.
- A **pop-out** button opens the same preview URL in a separate window. The refresh signal goes over a `BroadcastChannel` named after the entry instead of
  `postMessage` to the parent; the bridge listens on both. This gives translators with a second screen source, target and preview at once.
- Under the `lg` breakpoint the pane overlays the editor like the inspector does today.
- The pane's header: the preview URL, "up to date" or "updating", a device width toggle (full, 390 px) only if asked for later, reload, pop out, close.
- Clicking a link inside the preview stays inside the iframe. Leaving the preview route is allowed; the pane shows "Back to the entry" when the iframe's
  path no longer matches.

## 4. Site setup

A site changes its existing preview page; there is no new route.

```tsx
// app/(site)/preview/[locale]/posts/[slug]/page.tsx
import { LivePreviewBridge, livePreviewEntry } from "@monti-cms/live-preview/next";

export default async function PostPreviewPage({ params, searchParams }: Props) {
	await connection();
	const { locale, slug } = await params;
	const { entry, live } = await livePreviewEntry(cms, { collection: "post", slug: decodeURIComponent(slug), locale }, await searchParams);
	if (!entry) notFound();
	return (
		<>
			<PostView entry={entry} />
			<LivePreviewBridge live={live} />
		</>
	);
}
```

Without `?live=`, `livePreviewEntry` behaves exactly like `previewEntry`, so the header's Preview button keeps working. A site with several preview pages
changes each one. The plugin is added to `plugins` in the config like any other.

What the pane says when something is missing:

- No `site.previewPath`, or the collection has no public `path`: the toggle is disabled with the reason ("This collection has no preview page. Set the preview
  path in Schema → Site and a path for the collection.").
- A new entry that was never saved: "Save once to start the live preview." (The preview route looks the entry up by its stored slug.)
- The page loads but no `rendered` message arrives within 3 seconds: the iframe stays (it shows the last saved draft) with a banner, "This preview page does not
  follow your edits yet. Add the live preview to it:", the snippet above and a link to the plugin's README.
- The page reports a `seq` older than the last write after a refresh: "This page is not reading the live draft. Use `livePreviewEntry` in place of
  `previewEntry`."
- The iframe is blocked by frame headers: "This preview page cannot be shown in a frame. Allow same-origin frames, or use Pop out."

## 5. Open questions for the owner

1. **Transport: scratch draft on the server (D) or something faster but not the real renderer (A)?** Recommendation: D. A preview that is fast and wrong is
   worse than one that lags half a second and is the real page.
2. **Where the scratch draft lives: plugin storage (Postgres) or memory?** Recommendation: plugin storage. Memory breaks on serverless and on more than one
   instance, and the write rate is one small row per pause per admin.
3. **Unsaved text on the server: acceptable, and how to disclose it?** Today the editor promises that unsaved text never leaves the browser. Recommendation:
   accept it while the pane is open, delete on close or save, and say so once in the pane. The alternative (B) still sends the text, just without storing it.
4. **Add an `editor.changed` admin event now?** Recommendation: no. The pane reads the form itself; add the event when a plugin without UI needs it.
5. **Layout: right split that replaces the inspector, with source and preview exclusive below 1920 px?** Recommendation: yes, plus pop-out from the start,
   because it is cheap with this transport and it is the answer for translators.
6. **Should `previewEntry` become plugin-aware so sites change nothing?** Recommendation: no. An explicit helper call in the page is visible and greppable;
   "automatic is fine but silent is not".
7. **Scroll to the block being edited?** Recommendation: later. It needs block ids in the public HTML, which is a rendering decision of its own.
8. **Package name and home:** `@monti-cms/live-preview` in `packages/live-preview`, with the Next helper as a subpath export (`./next`). Recommendation: yes,
   following `@monti-cms/seo`.

Nothing is implemented until these are answered.
