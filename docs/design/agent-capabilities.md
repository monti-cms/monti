# Admin agent: capabilities

Status: inventory for [the admin agent design](agent.md). It lists every capability the admin has today, as found in the routes of core and the plugins,
and what each one becomes for the agent.

Columns:

- **Operation**: the proposed `defineOperation` name.
- **Kind**: `read` (the agent calls it freely), `write` (goes into a proposal), `code` (a pull request), or `—` (not an operation; the reason is in the notes).
- **Undo**: how a proposal reverses the write. "No" means the review says it cannot be undone.
- **Phase**: when it arrives (agent.md section 8).

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
| `entries.translate` | write | `POST /entries/[id]/translations` | Trash the translation | 3 | Creates a translation; filling it is `entries.update`, or the AI translation action |
| `entries.publish` | write | `POST /entries/[id]/publish`, bulk `publish` | **No**, when the entry was already published | 2 | Monti keeps no history, so the published version it replaces is gone. A first publish is undone by archiving |
| `entries.archive` | write | `POST /entries/[id]/archive`, bulk `archive` | Unarchive (back to draft, not republished) | 2 | Ends publication |
| `entries.unarchive` | write | `POST /entries/[id]/unarchive`, bulk `unarchive` | Archive | 2 | |
| `entries.trash` | write | `POST /entries/[id]/trash`, bulk `trash` | Restore | 2 | Ends publication |
| `entries.restore` | write | `POST /entries/[id]/restore` | Trash | 2 | |
| `entries.deletePermanently` | write | `DELETE /entries/[id]`, bulk `permanentDelete` | **No** | 3 | Only for entries already in the trash. Refused while something refers to the entry |
| `entries.moveToFolder` | write | bulk `folder.move`, `PATCH /entries/[id]` | Move back | 2 | |
| `entries.setRelation` | write | bulk `relation.add`, `relation.remove`, `relation.set` | The opposite change | 2 | Tags and categories are relation fields, so "tag these posts" is this |

The bulk route takes up to 100 items per call. A proposal with more items splits them into several bulk calls when it is applied.

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
| `site.describe` | read | `GET /meta` | | 1 | Collections, fields, body blocks, limits. The agent reads it at the start of every run, so it knows the site's shape |
| `schema.read` | read | `GET /schema` | | 1 | The schema file |
| `schema.edit` | code | `POST /schema/preview`, `PUT /schema` | Revert the pull request | 4 | Writes the file in development; elsewhere a pull request. The preview's impacts on stored entries go into the review, and the admin acknowledges them there |
| — | — | none | | | Site config in code (`defineSite`: locales, plugins, AI actions). Out of scope until the schema edit works as a pull request |

## Delivery and sync

| Operation | Kind | Route today | Undo | Phase | Notes |
| --- | --- | --- | --- | --- | --- |
| `events.list` | read | `GET /events` | | 3 | Failed and dead webhook deliveries |
| `events.retry` | write | `POST /events/[id]/retry` | Not needed | 3 | |
| `events.dismiss` | write | `POST /events/[id]/dismiss` | No | 3 | |
| `gitSync.status` | read | `GET /git-sync/status` | | 3 | Plugin operation |
| `gitSync.conflicts` | read | `GET /git-sync/conflicts` | | 3 | Plugin operation |
| `gitSync.pull` | write | `POST /git-sync/pull` | No | 3 | Plugin operation; changes many entries at once |
| `gitSync.push` | write | `POST /git-sync/flush` | No | 3 | Plugin operation; writes to the repository |
| `gitSync.resolve` | write | `POST /git-sync/resolve` | No | 3 | Plugin operation; the review shows both sides |

## AI and checks

| Operation | Kind | Route today | Undo | Phase | Notes |
| --- | --- | --- | --- | --- | --- |
| `ai.<action>` | read | `POST /ai/run` | | 3 | One operation per enabled action (summary, translation, alt text, tags...). Its result is text the agent then writes with `entries.update` |
| `spellcheck.run` | read | Bareun plugin route | | 3 | Plugin operation, when the Bareun plugin is installed |
| — | — | `/ai/actions`, `/ai/providers`, `/ai/settings`, `/ai/snippets`, `/ai/models` | | | The AI's own settings. The agent does not change what it is allowed to do or which model it uses |

## Not operations

| Route today | Why not |
| --- | --- |
| `/session/*` (sign-in, sign-out, first admin) | Signing in is the admin's |
| `/api-keys/*` | Key values never reach the agent, and choosing keys is the admin's |
| `/preferences` | The admin's own list columns and screen state, not site content |
| `/import/*` | Takes a file from the admin's computer |
| `/export/*` | Produces a download for the admin. The agent reads entries directly |
| `/events/retry` (cron), git-sync webhook, `/public/*` | Called by machines or the public site, not by the admin |
| CLI (`db:*`, `schema:*`, `admin:reset-password`, `events:retry`, `content:rewrite`) | Run on the machine that hosts the site |

## What phase 1 needs that does not exist

Almost every read the agent needs is a route already. The gaps:

1. **Lists across collections.** `entries.list` takes one collection. A question like "what did I change this week" needs one call per collection; that is
   fine for the agent, which reads `site.describe` first.
2. **Counts by relation value.** "Which tags are used least" means listing the tags collection and counting with `entries.usages`, one call per tag. A
   `relations.counts` read would make it one call. Add it only if the probe of phase 1 shows the agent struggling.
3. **Size of a proposal.** The bulk route stops at 100 items; the proposal splits larger applies itself (above).

## Counts

| Kind | Operations |
| --- | --- |
| read | 19 (`ai.<action>` counts once; it is one operation per enabled action) |
| write | 26 |
| code | 1 |

Phase 1 is 14 reads. Phase 2 adds 14 writes.
