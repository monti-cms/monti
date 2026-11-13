# @monti-cms/core

English | [한국어](README.ko.md)

Everything Monti does is an **operation**. One definition gives an admin API route, an agent tool and a CLI command, with the same input check, version
check and activity log, so no entry point has a way around another's rules. The design is in
[`docs/design/features/00-foundation.md`](../../docs/design/features/00-foundation.md).

```ts
import { defineOperation } from "@monti-cms/core";
import { z } from "zod";

export const moveToFolder = defineOperation({
	name: "entries.moveToFolder",
	kind: "write",
	description: "Move entries into a folder.", // for the model
	input: z.object({ ids: z.array(z.string()).min(1), folderId: z.string() }),
	touches: (input) => input.ids.map((id) => ({ kind: "entry", id })), // versioned and snapshotted for undo
	check: async (input, ctx) => {/* throw CheckError to refuse */},
	run: async (input, ctx) => {/* write through ctx.db; ctx.emit(event) for receivers */},
	summary: (input) => ({ key: "entries.moveToFolder", values: { count: input.ids.length } }), // the log's first line
	log: "save", // the group the activity log filters it by
});
```

## What runs a write

`createMonti({ db, operations, recordKinds, receivers, plugins })` runs every write the same way, in one transaction:

1. The input is checked against its schema.
2. The records it `touches` are read; a version the caller read that is no longer current is a conflict (`ConflictError`).
3. `check`, then `run`.
4. One activity row, with snapshots of the touched and created records, so the write can be undone for 30 days (`activity.undo`). Undo skips a record
   changed since, and never overwrites it.
5. The events it emitted are queued for each receiver and sent only after the commit.

A receiver is a webhook (`receivers: [webhook("https://example.dev/api/revalidate")]`) or a plugin's. A webhook has a name its deliveries are
stored and shown under (`webhook(url, { name })`; left out, the address's host alone): the address itself, with any token in its path or
query, is never stored. Two receivers of one site cannot share a name: two webhooks on one host each need a `name`. A redirect is not followed and is a failure. An address that does not
parse, or that carries a user or a password (`https://user:pass@…`), is refused when the site is made: send credentials in `headers`
(`Authorization`) or sign with `secret`. Why a delivery failed is kept as one of four kinds, never as an error's own text (which can quote
the address): the receiver's status, no answer (with the network's code), no such receiver, or failed. A send that fails, or takes longer than ten
seconds, shows as failed at once in the activity log and in the sidebar's count; it is tried again by itself eight times at growing waits
(`RETRY_MINUTES`), when the admin opens and from `monti deliveries:run`, and after the last it stays failed until a person sends it again
(`deliveries.retry`, a batch at a time) or cancels it (`deliveries.cancel`). The sends nobody waits for are handed to the host's `waitUntil`
(`openMonti(config, root, { waitUntil })`; `@monti-cms/next` passes Next's `after`), so a serverless function is not ended mid-send. The host
is given work to start, not a running promise: `waitUntil: (work) => context.waitUntil(work())`.
On such a host a write answers before its webhooks are sent; a receiver with `beforeAnswer: true` is still sent first (the site's own
cached pages are one: a publish that answered is on the site), within one deadline for the write (ten seconds; what is left is sent behind
the answer). A receiver with `oncePerWrite: true` does the same whatever the event and gets one send for a write, however many events it
emitted.

**An event can arrive twice.** A receiver may handle an event and lose its answer on the way back; Monti then counts a failure and sends it again.
Every try carries the same ids, so a receiver that must not act twice keeps the ids it has handled:

| Where | What |
|---|---|
| the body's `id`, header `Monti-Event-Id` | the event's id: the same on every try, and for every receiver of the event |
| header `Monti-Delivery-Id` | this receiver's delivery of it: the same on every try |
| header `Monti-Attempt` | which try this is, from 1 |
| header `Monti-Signature` | only with `webhook(url, { secret })`: `t=<seconds>,v1=<hex>`. `v1` is the HMAC-SHA256, in hex, of `<t>.<body>` under the webhook's secret, where `<body>` is the bytes posted. Make the same from the raw body and compare; refuse a `t` that is old. Never `MONTI_SECRET` |

The activity log shows a receiver by a name a person reads, never by the address it is stored under (a webhook's may carry a token): a
receiver's `label`, or without one a webhook's name (its host, when it was given none) and a plugin receiver's name. Why a delivery failed is
one of four sentences: the receiver's answer ("503 Service Unavailable"), no answer, no such receiver any more, or could not be sent. A
plugin's receiver that got an answer throws `ReceiverAnswer(status)` for the log to show it; any other error is "could not be sent", and
none of its text is stored.

A plugin's receiver gets the same as arguments: `send(event, signal, { id, attempt })`. `monti deliveries:run` leaves what only the running site
can send (the Next adapter's cache refresh) untried and says how many it left.

The activity log (`activity.list`, `activity.get`) shows every write as a line: what was done (`summary`), where (`where`), and how its deliveries
went. The writes one application of the assistant's proposal made are one line, undone together (`activity.undo`, which also takes a whole
proposal). An undo holds the records it puts back, as a write does, so it never goes over a save it did not see.

A record kind (`defineRecordKind`) tells the engine how to read a record's state and put an old state back.

## Entry points

| Entry point | Who | Writes |
|---|---|---|
| `createAdminApi(monti, { authenticate })` | the admin screen | run at once |
| `agentTools(monti)`, `callAgentTool(...)` | the assistant | become proposal items; `monti.proposals.apply` runs them later on the same path |
| `runCli(monti, argv, io)` | a developer in the terminal | run at once |

An operation marked `humanOnly` is never an agent tool. A `screen` operation is run by the browser, never by the server.

## The schema and the command line

A site has two files. `monti.schema.ts` holds the structure values its code relies on (collections, fields, public paths), as one plain value the
admin can write back. `monti.config.ts` imports it and names the database:

```ts
import { defineConfig } from "@monti-cms/core";
import schema from "./monti.schema";

export default defineConfig({ schema, database: process.env.DATABASE_URL, auth: { password: true } });
```

`auth` holds the ways the one admin signs in: `password: true`, `github: { clientId, clientSecret, admin }`, or both. With the password way the
first visit to the admin makes the admin. The admin API (`createAdminApi`) answers only the sign-in operations without its `httpOnly` session
cookie; a session ends after 30 days unused. A forgotten password is reset on the server with `monti admin:reset-password`.

On the dev server (the one that can write `monti.schema.ts`) a browser on this machine gets in without signing in, and the admin's sidebar
says so. The browser proves where it is with a one-time ticket from the loopback address (`devProof`, which an adapter such as
`@monti-cms/next` brings; without one nobody is let in): what a request says of itself proves nothing. It never applies on the live site or
on a hosting platform's process; `auth: { devBypass: false }` turns it off, to try the sign-in screens locally.

Labels, help texts, layout and editor permissions are admin values in the database (`collections.updateAdminValues`), editable on the live site too.

Structure changes only on the dev server. `schema.plan` lists what a draft changes and what the review must choose for stored values;
`schema.apply` writes `monti.schema.ts` and a change file under `monti/changes`, then applies it. The live site follows the same change files on
deploy, and has no way to change structure.

```sh
monti db:setup          # create the tables and follow every change file
monti db:migrate        # on deploy: follow the change files this database has not
monti deliveries:run    # send webhook retries that are due
monti trash:purge       # delete what the trash has kept for 30 days, and files nothing holds
monti admin:reset-password  # set the admin's password, sign every browser out
monti backup [--media] [--out file.zip]  # the whole site as one zip; --media puts the media files in it
monti restore file.zip  # an empty database only: everything back as it was, or every problem and nothing written
monti help              # every operation, each one a command
monti schema.read
```

## Entries and what the site reads

An entry has a working copy and, once published, a published copy. `entries.save` changes the working copy and takes the version it read, so no
caller can save over a save it has not seen. `entries.publish` copies the working copy to the site, making an empty slug from the title; a changed
published slug sends the old one on. `entries.checkPublish` is the one to-do list the publish reads; a plugin adds rows with `publishChecks`.

The site reads only published copies:

```ts
import { createReader } from "@monti-cms/core";

const site = createReader({ db, schema, secret: process.env.MONTI_SECRET });
await site.entry({ collection: "post", locale: "ko", slug }); // { entry } | { redirect } | null
await site.entries({ collection: "post", locale: "ko" });
await site.page({ collection: "post", locale: "ko", limit: 10, after }); // { entries, next }: a page at a time, by the last entry given
```

Each entry comes with its public address (`path`). `entries.previewLink` gives a one-hour token, signed with `MONTI_SECRET`, and the path to
open it at: the collection's own preview page when the schema names one (`previewPath: "/preview/:slug"`, a document collection's), the public
address otherwise. Passed as `preview`, the token opens that entry's working copy at that entry's own address only.

On a Next.js site, `@monti-cms/next` does this wiring: the admin page, the admin API route, the preview in draft mode and the cache refreshed
when something is published (`packages/next`, and the example site in `examples/blog`).

## Bodies

A body is a JSON document of blocks, each with an id that never changes. A block kind is one `defineBlock`: the catalog the assistant reads
(`blocks.catalog`), the publish to-do rows (its `check`) and the site's drawing come from it. Give the site's blocks to `monti.config.ts`
(`blocks`) and to `renderDocument`, with the site's own `createElement` (the core imports no framework):

```ts
import { createElement } from "react";
import { renderDocument } from "@monti-cms/core/render";

export const PostBody = ({ entry }) => renderDocument(entry.doc, { createElement, blocks, media: entry.media });
```

`media` is the reader's: the files the entry uses. An image is drawn at its own size, or at the width the writer gave it in px or as a share of
the body, and a narrower body shrinks it (`max-width: 100%`). A site with its own image component gives the image block a `Site` component,
which gets `image`: the picture ready to draw (`src`, `width`, `height`, `widthPercent`, `alt`, `placeholder`, `frame`, `original`). A media
field's picture comes the same way from `siteImage(entry.values.cover, entry.media)`:

```tsx
import Image from "next/image";
import { imageFrameStyle, type SiteImage } from "@monti-cms/core/render";

export function Picture({ image }: { image: SiteImage }) {
  const width = image.widthPercent === null ? image.width : `${image.widthPercent}%`;
  const blur = image.placeholder ? { placeholder: "blur" as const, blurDataURL: image.placeholder } : {};
  if (!image.frame)
    return <Image src={image.src} width={image.width} height={image.height} alt={image.alt} style={{ width, maxWidth: "100%", height: "auto" }} {...blur} />;
  // A cropped or turned picture: a box of the shape that shows, holding the whole file.
  const style = imageFrameStyle(image.frame);
  return (
    <span style={{ ...style.box, width, maxWidth: "100%" }}>
      <Image src={image.src} width={image.original.width ?? image.width} height={image.original.height ?? image.height} alt={image.alt} style={style.picture} />
    </span>
  );
}
```

The assistant reads a body with `body.read` (block ids and plain text) and changes it with `body.edit` (block operations), never by rewriting it. A
person's save and a block edit pass the same check. Templates are one list for the site (`templates.*`).

A link to an entry is `monti:entry/<translation group>` (`entryLink`), so it holds when the entry's slug changes. The reader's
`linkPaths(doc, locale)` gives `renderDocument`'s `entryPath`; a link to an entry not on the site is drawn as its text.

Every heading is drawn with an `id` made of its words (letters of any language kept, the same words again numbered), and
`tocOf(doc, { min, max })` gives the table of contents with those ids: `{ id, text, level, depth }` for levels 2 and 3 unless said.

### Code blocks

A code block holds its code as text, with its language, file name (`title`), whether the site shows line numbers, line effects over ranges of lines
(`highlight`, `focus`, `plus`, `minus`, `warning`, `error`, `collapse`, and `anchor`, a label a code link names) and regex rules. Bold, italic,
strike, underline, a fold (`codeFold`) and a tooltip (`codeTip`) go inside the code as marks. A code link in the text is the mark
`codeRef { block, anchor }`; one whose lines are gone blocks the publish.

`codeBlock` in `monti.config.ts` sets the two Shiki themes, the languages the editor offers, the editor's tools and the line effects:

```ts
codeBlock: {
	themes: { light: "github-light", dark: "github-dark" },
	languages: ["ts", "tsx", "bash", "json"],
	tools: { rules: false }, // rules, fold, tooltip, textStyles, links: all on unless false
	lineEffects: [{ name: "info", label: "Info", class: "line-info", editor: { tone: "neutral", marker: "i" } }],
},
```

The site opens the same colours once and hands them to `renderDocument`; `@monti-cms/core/render.css` is the default look (plain CSS), and
`<CodeTools />` of `@monti-cms/next` does the pressing (copy, code links):

```ts
import { codeHighlighter } from "@monti-cms/core/code";
export const code = codeHighlighter(config.codeBlock); // a promise: pages `await code`
renderDocument(entry.doc, { createElement, code: await code, locale: entry.locale });
```

## Plugins

A plugin is code in `monti.config.ts` (`plugins: [seo(), …]`): `definePlugin({ name, … })`. What it can add:

| Key | What it adds |
|---|---|
| `operations`, `recordKinds`, `streams` | Operations like the core's: admin API routes, agent tools, CLI commands |
| `blocks`, `marks` | Body blocks and marks |
| `fields` | Fields on document collections, in a tab of the property panel that is the plugin's (`{ tab, collections?, fields, columns? }`). They are not written to `monti.schema.ts`; `columns` names the ones a list offers as columns. A field may name its own `input`, and a `{ kind: "view" }` field draws a view and holds no value |
| `publishChecks` | Rows of the publish to-do list |
| `beforeSave` | Changes the values an entry is saved with (return them), or refuses the save (throw a `CheckError`; `says("…")` carries plain words) |
| `textCheck` | A check of the body's words, shown in a cell of the editor's status bar |
| `receivers` | Where events go after a write. Send with `receiverFetch(url, init)` so the log says what the other side answered |
| `keyServices`, `keys` | Services a key can be for, and the plugin's own key slots: rows of the keys screen, opened on the server with `monti.plugins.key(plugin, slot)` |
| `toolPages`, `importers` | Tabs of the tools page; file formats the import reads |
| `storage` | Where media files are |

What a plugin draws in the admin (a field's input, a view, a tool page's screen, a view of the document in the editors' ⋯) comes from its
browser half, `defineAdminPlugin` of `@monti-cms/admin`, handed to the admin page (`<AdminPage plugins={[…]} />`). `@monti-cms/seo` and
`@monti-cms/mdx` are plugins built on these.

## Backup, export and import

- `data.backup` gives the site as the text files of a backup (entries with their published copies and relations, folders, media records,
  addresses, templates, the admin's values) and the address of each media file; the admin zips them in the browser, and `monti backup` writes
  the same zip. The trash, the activity log, conversations and keys are not in it. `data.export` gives picked entries in the same shape,
  with what they point at. As a tool of the assistant both answer with a summary only.
- `monti restore` puts a backup into an empty database row for row. It checks the whole file first and writes nothing when anything is
  wrong.
- `data.inspect` reads an upload for one collection and writes nothing; `data.import` brings its entries in as drafts (the same body is
  skipped, a taken address gets `-2`, a relation value with no item makes one, the upload's pictures become files of the library). One
  import is one line of the activity log and is undone as a whole. Core reads Monti's own files; other formats come from a plugin's
  `importers` (`.md` and `.mdx` from `@monti-cms/mdx`).

## Tests

```sh
CMS_TEST_DATABASE_URL=postgres://localhost/monti_test pnpm test
```

Each test file migrates its own schema in the test database. Test titles start with the done criterion they keep (`00-1 …`), from the feature docs.
