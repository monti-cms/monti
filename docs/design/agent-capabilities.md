# Admin agent: capabilities

Status: inventory for [the admin agent design](agent.md). It lists every capability the admin has today, as found in the routes of core and the plugins,
and what each one becomes for the agent.

Columns:

- **Operation**: the proposed `defineOperation` name.
- **Kind**: `read` (the agent calls it freely), `write` (goes into a proposal), `code` (a pull request), `editor read` and `editor write` (run in the browser on the open entry; a write is a suggestion in the editor), or `—` (not an operation; the reason is in the notes).
- **Undo**: how a proposal reverses the write. "No" means the review says it cannot be undone.
- **Phase**: when it arrives (agent.md section 9).

## Entries

Route base: `/v1/entries`.

| Operation | Kind | Route today | Undo | Phase | Notes |
| --- | --- | --- | --- | --- | --- |
| `entries.list` | read | `GET /entries` | | 1 | Per collection. Filters already cover what the agent needs: text in title, slug or body (`search`, `includeBody`), status, locale, folder (with descendants), relation values, unpublished changes (`hasChanges`), created, updated and published date ranges, sort, paging |
| `entries.find` | read | `GET /entries/search` | | 1 | Title or slug lookup for a picker, at most 50 hits. The agent mostly uses `entries.list` |
| `entries.get` | read | `GET /entries/[id]` | | 1 | With `?format=<name>` the body comes as text (MDX), which is what the model should read and write |
| `entries.usages` | read | `GET /entries/[id]/relations` | | 1 | Where an entry is used, draft and published |
| `entries.translations` | read | `GET /entries/[id]/translations` | | 1 | The translation group |
| `entries.checkPublish` | read | `POST /entries/[id]/check` | | 1 | What publishing would find, without publishing. A read, though it is a `POST` |
| `entries.create` | write | `POST /entries` | Trash it | 2 | Title, slug, metadata, body as text, folder |
| `entries.update` | write | `PATCH /entries/[id]` | Write the before values back | 2 | Any of slug, metadata fields, body, folder. The preview is a field-by-field diff, the body a text diff |
| `entries.duplicate` | write | `POST /entries/[id]/duplicate` | Trash the copy | 2 | |
| `entries.translate` | write | `POST /entries/[id]/translations` | Trash the translation | 3 | Creates a translation; filling it is `entries.update`, or a built-in request of the translation editor |
| `entries.publish` | write | `POST /entries/[id]/publish`, bulk `publish` | **No**, when the entry was already published | 2 | Monti keeps no history, so the published version it replaces is gone. A first publish is undone by archiving |
| `entries.archive` | write | `POST /entries/[id]/archive`, bulk `archive` | Unarchive (back to draft, not republished) | 2 | Ends publication |
| `entries.unarchive` | write | `POST /entries/[id]/unarchive`, bulk `unarchive` | Archive | 2 | |
| `entries.trash` | write | `POST /entries/[id]/trash`, bulk `trash` | Restore | 2 | Ends publication |
| `entries.restore` | write | `POST /entries/[id]/restore` | Trash | 2 | |
| `entries.deletePermanently` | write | `DELETE /entries/[id]`, bulk `permanentDelete` | **No** | 3 | Only for entries already in the trash. Refused while something refers to the entry |
| `entries.moveToFolder` | write | bulk `folder.move`, `PATCH /entries/[id]` | Move back | 2 | |
| `entries.setRelation` | write | bulk `relation.add`, `relation.remove`, `relation.set` | The opposite change | 2 | Tags and categories are relation fields, so "tag these posts" is this |

The bulk route takes up to 100 items per call. A proposal with more items splits them into several bulk calls when it is applied.

## The open entry (editor)

These run in the browser on the entry open in the editor (agent.md section 5). There is no route: they act on the form, not on the server. A write is a
suggestion the admin accepts or rejects in the editor, and nothing is saved until the admin saves.

| Operation | Kind | Route today | Undo | Phase | Notes |
| --- | --- | --- | --- | --- | --- |
| `editor.read` | editor read | none | | 1 | The open entry as the form holds it, unsaved changes included: fields, and the body as text in the site's format |
| `editor.selection` | editor read | none | | 1 | The selected text and the block at the cursor, with its block id. Also sent with the screen context |
| `editor.replaceSelection` | editor write | none | Reject the suggestion | 2 | |
| `editor.rewriteBlock` | editor write | none | Reject the suggestion | 2 | A paragraph, heading, list or block, by block id |
| `editor.insertBlocks` | editor write | none | Reject the suggestion | 2 | Before or after a block; the blocks as text in the site's format, so code blocks, images and custom blocks work |
| `editor.moveBlocks` | editor write | none | Reject the suggestion | 2 | |
| `editor.removeBlocks` | editor write | none | Reject the suggestion | 2 | |
| `editor.setField` | editor write | none | Reject the suggestion | 2 | A field of the properties panel: title, slug, summary, tags, and the other fields of the collection |

A server write to the entry open in the editor is refused, and the model is told to use these instead. Publishing, archiving and trashing the open entry
stay server operations; the editor saves first, as its own buttons do.

## Folders

| Operation | Kind | Route today | Undo | Phase | Notes |
| --- | --- | --- | --- | --- | --- |
| `folders.list` | read | `GET /folders` | | 1 | The tree of one collection |
| `folders.get` | read | `GET /folders/[id]` | | 1 | With the number of entries and child folders, the preview of a delete |
| `folders.create` | write | `POST /folders` | Delete it | 2 | |
| `folders.update` | write | `PATCH /folders/[id]` | Write the before values back | 2 | Rename, move under another parent, reorder |
| `folders.delete` | write | `DELETE /folders/[id]` | Recreate it and move its entries and children back | 3 | Entries and child folders move to the parent; nothing is deleted with it |

## Media

| Operation | Kind | Route today | Undo | Phase | Notes |
| --- | --- | --- | --- | --- | --- |
| `media.list` | read | `GET /media` | | 1 | Filename search, type, folder, upload date, and `used: "unused"`, which is "find unused media" already |
| `media.get` | read | `GET /media/[id]` | | 1 | With where it is used |
| `media.update` | write | `PATCH /media/[id]` | Write the before values back | 2 | Filename, default alt text and caption, folder |
| `media.delete` | write | `DELETE /media/[id]` | **No** | 2 | Refused with `in_use` while anything refers to the file, so the agent cannot delete a used file even by mistake |
| `media.cleanupUploads` | write | `POST /media/cleanup` | Not needed | 3 | Removes failed uploads older than a day |
| — | — | `POST /media/uploads`, `POST /media/[id]/complete` | | | Uploading needs the file from the admin's computer. Later: an upload from a URL the admin gives |

## Templates

| Operation | Kind | Route today | Undo | Phase | Notes |
| --- | --- | --- | --- | --- | --- |
| `templates.list` | read | `GET /templates` | | 1 | |
| `templates.get` | read | `GET /templates/[id]` | | 1 | Body as text with `?format=` |
| `templates.create` | write | `POST /templates` | Delete it | 3 | |
| `templates.update` | write | `PATCH /templates/[id]` | Write the before values back | 3 | |
| `templates.delete` | write | `DELETE /templates/[id]` | Recreate it | 3 | |

## Site structure

| Operation | Kind | Route today | Undo | Phase | Notes |
| --- | --- | --- | --- | --- | --- |
| `site.describe` | read | `GET /meta` | | 1 | Collections, fields, body blocks, limits. The agent reads it at the start of every run, so it knows the site's shape. From phase 2 it carries the field and collection descriptions, which tell the agent what each field is for (agent.md section 7) |
| `schema.read` | read | `GET /schema` | | 1 | The schema file |
| `schema.edit` | code | `POST /schema/preview`, `PUT /schema` | Revert the pull request | 4 | Writes the file in development; elsewhere a pull request. The preview's impacts on stored entries go into the review, and the admin acknowledges them there |
| — | — | none | | | Site config in code (`defineSite`: locales, plugins). Out of scope until the schema edit works as a pull request |

## Delivery and sync

| Operation | Kind | Route today | Undo | Phase | Notes |
| --- | --- | --- | --- | --- | --- |
| `events.list` | read | `GET /events` | | 3 | Failed and dead webhook deliveries |
| `events.retry` | write | `POST /events/[id]/retry` | Not needed | 3 | |
| `events.dismiss` | write | `POST /events/[id]/dismiss` | No | 3 | |

## AI and checks

| Operation | Kind | Route today | Undo | Phase | Notes |
| --- | --- | --- | --- | --- | --- |
| `spellcheck.run` | read | The text-check plugin route | | 3 | Plugin operation, when a spell-check plugin is installed |
| — | — | `POST /ai/run`, `/ai/actions`, `/ai/snippets` | | | Removed in phase 3 with actions, custom actions and snippets (agent.md section 7). There is no `ai.<action>` operation: the agent writes the summary, alt text or translation itself |
| — | — | `/ai/providers`, `/ai/settings`, `/ai/models` | | | The model moves to a picker in the assistant input, per conversation; the API keys screen shows each key's monthly usage and cap. The agent does not change which model it uses or what it may spend |
| — | — | none | | | The writing voice (Settings › Site). Every run gets it as context; it is not a tool call |

### Built-in requests

Not operations: each is a fixed sentence sent to the agent with the screen context, run as one turn with only the tools it needs (agent.md section 7).

| Place | Request | Tools | Phase |
| --- | --- | --- | --- |
| The publish to-do | Write the summary | `editor.read`, `editor.setField` | 3 |
| The publish to-do | Fill missing alt text | `editor.read`, `media.get`, `editor.rewriteBlock` | 3 |
| The translation editor | Translate from the source | `entries.get` (the source), `editor.read`, `editor.rewriteBlock`, `editor.setField` | 3 |
| The translation editor | Translate only the blocks that changed | The same, limited to the blocks changed in the source since the translation | 3 |
| The bulk bar of the media list | Fill alt text | `media.get`, `media.update` | 3 |

## Not operations

| Route today | Why not |
| --- | --- |
| `/session/*` (sign-in, sign-out, first admin) | Signing in is the admin's |
| `/api-keys/*` | Key values never reach the agent, and choosing keys and their monthly caps is the admin's |
| `/preferences` | The admin's own list columns and screen state, not site content |
| `/import/*` | Takes a file from the admin's computer |
| `/export/*` | Produces a download for the admin. The agent reads entries directly |
| `/events/retry` (cron), plugin webhooks, `/public/*` | Called by machines or the public site, not by the admin |
| CLI (`db:*`, `schema:*`, `admin:reset-password`, `events:retry`, `content:rewrite`) | Run on the machine that hosts the site |

## What phase 1 needs that does not exist

Almost every read the agent needs is a route already. The gaps:

1. **Lists across collections.** `entries.list` takes one collection. A question like "what did I change this week" needs one call per collection; that is
   fine for the agent, which reads `site.describe` first.
2. **Counts by relation value.** "Which tags are used least" means listing the tags collection and counting with `entries.usages`, one call per tag. A
   `relations.counts` read would make it one call. Add it only if the probe of phase 1 shows the agent struggling.
3. **Size of a proposal.** The bulk route stops at 100 items; the proposal splits larger applies itself (above).

## What the single AI path needs (agent.md section 7)

Core, in phase 2, before the agent writes:

1. **Field descriptions as agent input.** `description` of a field (`packages/core/src/schema/fields.ts`) is sent to the agent with `site.describe` and is
   no longer rendered under the input. The field settings sheet of the schema settings edits it. Collection descriptions go the same way.
2. **Checks in field definitions.** `max`, `required` and the other limits of a field are checked by the write operations' previews, and a unique slug is a
   check of `entries.create` and `entries.update`, so a value that breaks them is refused before it reaches a proposal.
3. **The writing voice.** One text in Settings › Site, stored with the site settings and added to the context of every run.
4. **Model per conversation.** The assistant input has a model picker listing the models of the stored keys, grouped by provider. A run is stored with
   its model; a new conversation starts with the last used one.
5. **Usage and the monthly cap.** Each run records its tokens against the key it used; the API keys screen shows each key's month of usage with an
   approximate cost and an optional cap. A run or built-in request on a key past its cap is refused, and the panel shows the notice in place of its input.

Moving the AI over, in phase 3. Each place an action attaches today becomes a built-in request or goes away:

| Today | Becomes |
| --- | --- |
| AI buttons beside fields (slug, summary, tags, category) | Removed. The summary is the publish to-do's "write the summary" |
| Alt text and caption of a body image, and the automatic fill on upload (`auto-image-text.ts`) | Removed. Missing alt text is the publish to-do's "fill missing alt text" |
| Media filename, default alt text and caption | Default alt text is the media bulk bar's "fill alt text"; the rest is removed |
| Block translate and "translate all" in the translation editor | "Translate from the source" and "translate only changed blocks" |
| Code fold rules | Removed |
| The selection menu (polish), the insert menu (draft) and body block buttons | Removed; asked in the panel, with the selection in the screen context |
| Custom actions, prompt snippets and the AI settings tab | Removed. The `styleGuide` snippet becomes the writing voice; the model is picked in the assistant input, and usage and caps are on the API keys screen |

Out of scope for now: proposals from several admins at once. A Monti site has a single admin.

## Counts

| Kind | Operations |
| --- | --- |
| read | 18 |
| write | 26 |
| code | 1 |
| editor read | 2 |
| editor write | 6 |

Phase 1 is 14 reads and 2 editor reads. Phase 2 adds 14 writes and 6 editor writes.
