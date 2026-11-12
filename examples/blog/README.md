# The example blog

A blog on Next.js with Monti mounted on it the way [`@monti-cms/next`](../../packages/next) says: posts (`/posts/:slug`), notes (`/notes/:slug`)
and categories (`/categories/:slug`), in Korean with English and Japanese translations (`/en/…`, `/ja/…`). The repo's flow tests
(`pnpm test:e2e`) run on this app, so what is shown here is what is tested.

## Run it

```sh
cp .env.example .env.local      # DATABASE_URL (Postgres) and MONTI_SECRET
pnpm --filter @monti-cms/admin build:styles   # inside this repo only: the admin's stylesheet is a built file
pnpm db:setup                   # the tables
pnpm dev                        # http://localhost:3000, the admin at /admin
```

`pnpm dev` is the dev server: the admin opens without signing in on this machine, and its settings write `monti.schema.ts`.
`pnpm build && pnpm start` is a live site: it asks to sign in (the first visit makes the admin) and structure is locked. The build draws the
first page and the list of posts, so it needs the database.

## What is where

| File | What it is |
|---|---|
| `monti.schema.ts` | The site's structure: collections, fields, public addresses, languages. Values only: the admin writes it back |
| `monti.config.ts` | How the site runs Monti: the database, the sign-in, where media files go |
| `lib/monti.ts` | Opens Monti once: `monti` for the admin API, `reader` for the pages |
| `app/admin/page.tsx` | The admin. The folder's name is its address |
| `app/admin/api/[...path]/route.ts` | The admin's API, the media files, the preview's on and off |
| `app/(site)/…` | The site's pages, for Korean; `app/(site)/[locale]/…` for the translations |
| `site/pages.tsx` | What those pages draw |
| `app/site.css` | The site's looks, all under `.site` so they do not reach the admin's page |

Media files go to `.monti/files` on this machine (`MONTI_FILES` moves it); `MONTI_STORAGE=off` runs the site with no storage.
