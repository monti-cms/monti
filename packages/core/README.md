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
	summary: (input) => ({ key: "entries.moveToFolder", values: { count: input.ids.length } }),
});
```

## What runs a write

`createMonti({ db, operations, recordKinds, receivers, plugins })` runs every write the same way, in one transaction:

1. The input is checked against its schema.
2. The records it `touches` are read; a version the caller read that is no longer current is a conflict (`ConflictError`).
3. `check`, then `run`.
4. One activity row, with snapshots of the touched and created records, so the write can be undone for 30 days (`activity.undo`). Undo skips a record
   changed since, and never overwrites it.
5. The events it emitted are queued for each receiver and sent only after the commit. A failed send is retried on a schedule (`RETRY_MINUTES`).

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

Labels, help texts, layout and editor permissions are admin values in the database (`collections.updateAdminValues`), editable on the live site too.

Structure changes only on the dev server. `schema.plan` lists what a draft changes and what the review must choose for stored values;
`schema.apply` writes `monti.schema.ts` and a change file under `monti/changes`, then applies it. The live site follows the same change files on
deploy, and has no way to change structure.

```sh
monti db:setup          # create the tables and follow every change file
monti db:migrate        # on deploy: follow the change files this database has not
monti deliveries:run    # send webhook retries that are due
monti admin:reset-password  # set the admin's password, sign every browser out
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
```

`entries.previewLink` gives a one-hour token, signed with `MONTI_SECRET`; passed as `preview`, it opens that entry's working copy.

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

## Tests

```sh
CMS_TEST_DATABASE_URL=postgres://localhost/monti_test pnpm test
```

Each test file migrates its own schema in the test database. Test titles start with the done criterion they keep (`00-1 …`), from the feature docs.
