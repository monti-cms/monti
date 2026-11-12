# @monti-cms/next

Monti on a Next.js site (App Router, Next 16): the admin as a page of the site, the admin API as a route, the preview in draft mode, and the
site's cached pages refreshed when something is published. The example site in [`examples/blog`](../../examples/blog) uses everything here.

## The three files

```ts
// lib/monti.ts
import { openSite } from "@monti-cms/next";
import config from "../monti.config";

export const { monti, reader } = openSite(config);
```

```tsx
// app/admin/page.tsx
import { AdminPage } from "@monti-cms/next/admin";

export default () => <AdminPage siteName="My blog" />;
```

```ts
// app/admin/api/[...path]/route.ts
import { adminRoute } from "@monti-cms/next";
import { monti } from "@/lib/monti";

export const { GET, POST, PUT } = adminRoute(monti);
```

The folder of the admin page is the admin's address (`app/admin` is `/admin`), and its API is `api` under it. To move the admin, rename the
folder.

## Pages

The site's pages are the site's own. `entryPage` reads one entry for a page:

```tsx
// app/posts/[slug]/page.tsx
import { renderDocument, tocOf } from "@monti-cms/core/render";
import { entryPage } from "@monti-cms/next";
import { createElement } from "react";
import { reader } from "@/lib/monti";

export default async function Post({ params }: { params: Promise<{ slug: string }> }) {
	const post = await entryPage(reader, { collection: "post", slug: (await params).slug });
	return (
		<article>
			<h1>{post.title}</h1>
			{post.doc && renderDocument(post.doc, { createElement, media: post.media, entryPath: post.entryPath })}
		</article>
	);
}
```

- No entry at that address: `notFound()`. An address the entry had before: `permanentRedirect()` to where it is now.
- `locale` is the source language unless given. `reader.locales()` says which languages the site has.
- `reader.page({ collection, locale, limit, after })` reads a list a page at a time; `reader.entries` reads all of it. Each entry has its public
  address (`path`).
- `tocOf(post.doc)` gives the table of contents; the headings `renderDocument` draws carry the same ids.

## Preview

"Preview" in the editor opens `<admin>/api/preview?token=…&path=…`. A good token turns Next's draft mode on for that browser and goes to the
entry's public address, where `entryPage` then reads the working copy. Nobody else sees it, another entry opened meanwhile is what the site
shows, and the token ends after an hour.

- `<PreviewBar />` in the site's layout shows one line while a preview is open, with the way out (`labels` for its two words, `admin` when the
  admin is not at `/admin`). The preview works without it.
- A site with a preview page of its own names its address in the schema (`previewPath: "/preview/:slug"` on a document collection, also editable
  in the admin's settings) and reads the entry there with `previewPage`, which is not found for anyone who did not open the preview.

## The site's cache

A Next site keeps the pages it has drawn, so something must tell it when an entry is published. `openSite` does: Monti's events reach the
site inside the admin API's request.

What is drawn again is the site's to decide:

```ts
// lib/monti.ts
export const { monti, reader } = openSite(config, {
	refresh: (event) => {
		// event.type, event.ids, event.paths (public addresses)
		for (const path of event.paths ?? []) revalidatePath(path);
	},
});
```

- **Nothing given** (the default): every cached page of the site is marked to be drawn again (`refreshSite()`), and each is drawn when it is next
  visited. Nothing stays old, without a line of the site's: a list, a post that names a category, a translation that follows its source all
  show an entry besides its own page.
- **A function**: it runs instead, for every event a visitor could see (not for a save alone, an uploaded file or the admin's own values).
  Call `refreshSite()` in it for the cases the site does not narrow.
- **`false`**: the adapter does nothing; listen with a receiver of the site's own (`receivers` in `monti.config.ts`).

The mark is on this server process's cache. A site run as several processes or machines needs a cache they share (a Next cache handler);
with the stock one, an entry published through one process stays old on the others.

## The dev server and the live site

`next dev` with a `monti.schema.ts` it can write is the dev server; anything else is the live site.

| | dev server | live site |
|---|---|---|
| structure (collections, fields, addresses) | edited in the admin, written to `monti.schema.ts` | locked |
| signing in | a browser on this machine gets in without it (`auth: { devBypass: false }` turns that off) | always |
| the first call of the admin API | follows a schema file edited by hand, and says so | says to run `monti db:migrate` when the database is behind |

A browser proves it is on this machine with a one-time ticket it fetches from a listener on the loopback address, which nothing outside the
machine reaches. What a request says of itself (`Host`, `X-Forwarded-For`) lets nobody in: the sender writes those. When the ticket cannot be
fetched (another machine, a server in a container) the admin asks to sign in.

Open the dev server's admin at `localhost`. Next's dev server runs a page's code in the browser only for the hosts it knows, and the admin is
drawn in the browser: under another host (`127.0.0.1`, a LAN address, a tunnel) it stays blank until that host is named in `next.config`:

```ts
// next.config.ts
allowedDevOrigins: ["127.0.0.1"],
```

## Styles

`AdminPage` brings the admin's stylesheet (`@monti-cms/admin/styles.css`). It touches nothing outside the admin: every rule applies only in a
document that holds the admin, and its variables, keyframes and fonts are its own. The other way round is the site's to keep: the admin is a
page of the same app, so a bare rule of the site's (`main { max-width: … }`, `td { border: … }`) reaches it. Keep the site's styles under the
site's own layout, as the example does with `.site`.
