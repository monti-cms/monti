# The showcase

English | [한국어](README.ko.md)

One Next.js site that uses every Monti feature, with a seed that fills it: the app to try each feature by hand and to check a
release on. Its structure has every field kind and option the core has, every collection kind, three languages, every plugin, and the
seed makes an entry for each state. The repo's flow tests run on [`examples/blog`](../blog), not here.

## Run it

```sh
cp .env.example .env.local      # DATABASE_URL (Postgres) and MONTI_SECRET; the rest is optional
pnpm --filter @monti-cms/admin build:styles   # inside this repo only: the admin's stylesheet is a built file
createdb monti_showcase         # an empty database
pnpm db:setup                   # the tables
pnpm seed                       # the sample content (it refuses a database that has entries)
pnpm dev                        # http://localhost:3000, the admin at /admin
```

To start over: `dropdb monti_showcase && createdb monti_showcase && pnpm db:setup && pnpm seed`, and delete `.monti/files`.

The dev server opens the admin without signing in on this machine, and its settings write `monti.schema.ts`. `pnpm build && pnpm start`
is a live site: it asks to sign in (the first visit makes the admin) and structure is locked.

What to connect yourself:

- **The assistant**: a model service's key under Tools › API keys. Without one, ✦ says there is no key.
- **S3 or R2**: the `S3_*` values in `.env.local` ([`@monti-cms/storage-s3`](../../packages/storage-s3)). Without them files go to
  `.monti/files`. Seed again after switching: the seeded files are in the storage the seed ran with.
- **A webhook that works**: `MONTI_WEBHOOK=http://localhost:3000/hooks/ok`. Open `/hooks/ok` to see the last 20 events it got.

## What is where

| File | What it is |
|---|---|
| `monti.schema.ts` | The structure: four collections, every field kind and option, three languages |
| `monti.config.ts` | The storage (S3 when set, else a folder), the plugins (assistant, SEO, MDX), the hooks |
| `seed/seed.ts` | `pnpm seed`: everything below, through the core's operations (`monti.run`) |
| `seed/files/` | The seed's pictures and files; `seed/import/walking-notes.mdx` is a file to import by hand |
| `app/hooks/[name]/route.ts` | Two hooks of the site's own: `/hooks/ok` keeps what it gets, `/hooks/broken` always answers 503 |
| `app/admin/…` | The admin, with the SEO and MDX plugins' browser halves |
| `app/(site)/…`, `app/[locale]/…` | The site's pages: Korean without a prefix, `/en/…` and `/ja/…` |
| `site/pages.tsx` | What those pages draw: every field of an entry, then its body |
| `app/site.css` | The site's looks, all under `.site` |

## The structure

| Collection | Kind | Address | What it shows |
|---|---|---|---|
| `article` | document | `/articles/:slug`, preview at `/preview/articles/:slug` | Every field kind: text (multi-line, max, per language, from the source), slug from the title, select (one required, many), media (picture, any file), relations (one, many ordered, many made on the fly, to its own collection, edited from the other side), a conditional field with a required field under an option and a conditional field inside an option, a switch |
| `tag` | item (taxonomy) | `/tags/:slug` | Live on save, made from an article's tag field too |
| `person` | item | `/people/:slug` | `articles` edits the articles' `authors` from this side |
| `series` | item, no page | none | Data only: read where an article names it |

The fields have Korean names, descriptions and option names (admin values), and the article's panel has four tabs, one with a group.
Field kinds the core does not have (number, date, a yes/no field, lists, repeating groups, a unique rule other than the address) are not
here: the switch (`pinned`) is the core's yes/no.

## What the seed makes

| Entry | State | What to look at |
|---|---|---|
| 블록과 서식을 모두 쓴 글 (`every-block`) | published, pinned | Every core block and mark, footnotes, pictures (width %, px, cropped and turned, decorative), files, an entry link; SEO fields; English published, Japanese a draft with 15 blocks to translate |
| 항구를 걷는 영상 (`harbor-video`) | published | Format "video"; its English was published, then the source changed: the English is 2 changes behind |
| 숲 사진첩 (`forest-gallery`) | changed | Format "gallery"; saved after publishing, so the site shows the published copy |
| 사막의 밤하늘 (바깥 링크) (`desert-night-link`) | published, and a copy | Format "link", external; Japanese published (the one Japanese page); the copy is a draft |
| 안내서에서 시작한 초안 (안쪽 링크) (`from-template`) | draft | Started from the template; format "link", internal, pointing at the first article |
| 영상 주소가 빠진 초안 (`missing-video-url`) | draft, blocked | The option's required field is empty, and a picture has no alt text: two to-dos |
| 주소 없는 초안 | draft, blocked | No address |
| 지난 봄 소식 (보관됨) (`last-spring`) | archived | Off the site |
| 휴지통에 넣은 글 | in the trash | Restore it |

Also: folders 안내 › 국내 and 소식 for articles; media folders 표지 › 2026, 인물, 문서 with five pictures, a PDF and a CSV, a picture used
nowhere at the top, and in the trash a picture and the folder 지난 행사 with a file in it; six tags (English for all, Japanese for two; 겨울 used by
nothing) and one made from an article's field; two people (one in English); two series; the template 여행 안내서; and failed deliveries to the broken hook (seeded while no server ran, so they failed with `ECONNREFUSED`; sent
again under `pnpm dev`, they fail with its 503).

## QA checklist

One line per feature, by feature doc (`docs/design/features`). "Admin" is where to try it, "site" where to see it.

### 00 · Foundation

- [ ] Every operation as a command: `pnpm exec monti help`, then e.g. `pnpm exec monti entries.checkPublish --id <id>`.
- [ ] Plugin operations and tools: `pnpm exec monti help` lists the SEO, MDX and assistant ones.

### 01 · Content structure

- [ ] Field kinds and options: admin › Settings › Collections › 글 › Fields lists each; the site's article page shows each value.
- [ ] Changing structure: add a field in Settings, save, review the plan, apply; `monti.schema.ts` and `monti/changes/` are written.
- [ ] Admin values: rename a field's label (works on the live site too); the panel's tabs and group come from `layout`.
- [ ] Export a collection with its definition: `pnpm exec monti collections.export --collection article`.

### 02 · Entry lifecycle

- [ ] Create, save, publish with the date kept or today: admin › 글 › + New; site › the article's page.
- [ ] Conflict: open one article in two tabs, save in both; the second shows what differs (Compare).
- [ ] To-dos block publishing: 영상 주소가 빠진 초안 and 주소 없는 초안.
- [ ] Archive and unarchive: 지난 봄 소식; its page is gone from the site.
- [ ] Duplicate: More › Duplicate (the seed made one of 사막의 밤하늘).
- [ ] Preview: Preview on any draft opens `/preview/articles/<slug>` with the preview bar; the bar's exit ends it.

### 03 · Body editor

- [ ] Every block and mark: open 블록과 서식을 모두 쓴 글; the slash menu and the toolbar add each; the site draws each.
- [ ] Footnotes, table column widths, aligned paragraphs, a hard break: in the same article.
- [ ] Templates: Tools › Templates (여행 안내서); + New › from a template; 안내서에서 시작한 초안 was made from it.
- [ ] Table of contents: the site's article page lists its headings.

### 04 · Languages

- [ ] Translation done: the first article's English (`/en/articles/every-block`); in Japanese, `/ja/articles/desert-night-link`.
- [ ] Partly done: its Japanese draft; each pending block, keep the source's words or translate; publishing waits for all.
- [ ] Stale: 항구를 걷는 영상 in English shows the changed and added blocks; update or confirm them.
- [ ] Fields per language: summary (own), subtitle (from the source), cover (from the source), topic (one for all).
- [ ] The list's language column and filter; + Language on an entry; the site's language line.
- [ ] Items in languages: a tag's side panel saves all its languages at once; Japanese has only 海 and 森.
- [ ] Change the site's languages or address prefix: Settings › Languages, with its review; the site's pages follow the prefix.

### 05 · Changes and proposals

- [ ] Unsaved changes: edit a field, see the changed mark, undo it; leave the page and be asked.
- [ ] Proposals in the editor's fields and body: ask the assistant to change a field, then take or leave it in place.

### 06 · List

- [ ] Filters, sort, search, page size: admin › 글; filter by state (draft, published, changed, archived), topic, season, tag.
- [ ] Add column (summary, SEO fields), reorder, hide, resize; kept per collection.
- [ ] Select rows and act on them: publish, archive, change tags, move, to the trash.

### 07 · Folders

- [ ] Article folders 안내 › 국내 and 소식: create, rename, move (not into itself), move entries in.
- [ ] Delete a folder: it goes to the trash with what is in it.

### 08 · Relations

- [ ] One (series), many ordered (tags, related), made on the fly (type a new tag), to its own collection (related).
- [ ] Both sides: 이바다's `articles` (person panel) and the articles' `authors` are the same links.
- [ ] Usage: admin › 태그 shows how many entries use each tag; the "Unused" filter finds one no entry uses.
- [ ] Merge tags; bulk change a relation from the list.
- [ ] Site: the article's series, authors, tags and related, each linked (a fallback to Korean says so).

### 09 · Media

- [ ] Upload (drag in, or the button), folders, search, kind, "Not used" (쓰지 않는 그림.png), sort.
- [ ] A file's side panel: rename, move, where it is used, replace (with the count of uses).
- [ ] Alt text: 영상 주소가 빠진 초안's picture has none; its to-do opens the picture's alt text, and publishing waits for it.
- [ ] Pictures in the body: width in %, in px, crop, turn, align, caption, decorative; the site draws each.
- [ ] Storage: with `S3_*` set, upload and see the file at `S3_PUBLIC_URL`; `MONTI_STORAGE=off` shows what the admin says without one.

### 10 · Assistant

- [ ] Needs a key: Tools › API keys. Then ✦ in the frame opens the panel.
- [ ] Ask for a change; the proposal card; review; apply; undo all of it.
- [ ] ✦ in the editor (fill a field, translate, a request on one proposal), in the list, the trash, the activity log and settings.
- [ ] Past conversations; the model menu; the quick-task model.

### 11 · Trash

- [ ] The trash has an article, a picture and a folder with a file: restore each; delete for good; empty.
- [ ] Move a published article to the trash: its page leaves the site, and its translations go with it.

### 12 · Settings

- [ ] Tabs: Site, Languages, Collections (Basics, Fields, Editor), Admin.
- [ ] The editor's allowed blocks and marks per collection.
- [ ] Admin: the screen's language (Korean, English). Screen mode (light, dark) is in the frame's menu.

### 13 · Activity and delivery

- [ ] Every seed write is a line; filter by kind, by delivery state, by date, by entry.
- [ ] Failed deliveries: the sidebar count, the banner, each line's deliveries to `broken`; Send again (fails again), Send all again,
      Cancel.
- [ ] A working delivery: set `MONTI_WEBHOOK`, publish, open `/hooks/ok`.
- [ ] Undo a line (publish, trash, a template's removal), with what it skips.

### 14 · Data, keys and plugins

- [ ] Backup with and without media files: Tools › Data › Backup; restore into an empty database: `pnpm exec monti restore file.zip`.
- [ ] Import: a list's + New ▾ › Import, `seed/import/walking-notes.mdx`; match its front matter to fields; `<Tweet />` is kept with a
      to-do.
- [ ] Export some entries: select rows › More › Export, or a row's menu › Export.
- [ ] View as MDX: the editor's More.
- [ ] API keys: add, rename, remove; models per key.
- [ ] SEO: the article's SEO tab (preview, title and description counts, share image, hide from search, canonical); the site's `<head>`.
- [ ] Plugins: Settings shows each plugin's tab and slots locked.

### 15 · Sign-in and frame

- [ ] The dev server lets this machine in without signing in; `pnpm build && pnpm start` asks, and the first visit makes the admin.
- [ ] `pnpm exec monti admin:reset-password`.
- [ ] The frame: counts per collection, the trash's count, failed deliveries.

### 16 · The site

- [ ] Every collection's page in each language: `/`, `/en`, `/ja`, `/articles/…`, `/tags/…`, `/people/…`; series have no page.
- [ ] Publishing refreshes the cached pages (`pnpm build && pnpm start`): publish, reload.
- [ ] An old address goes to the new one after the slug changes and the entry is published again.
- [ ] The site's own preview page (`previewPath`).

### 19 · Conditional fields

- [ ] Format: each option shows its own fields; 영상 needs its address; 링크 has a choice inside it (바깥 · 안쪽).
- [ ] The switch 맨 위에 고정 and its note.
- [ ] Changing the option drops the other option's values, and the editor says so; the site reads only the chosen option's fields.
- [ ] Remove or rename an option in Settings, with its review.

### 20 · Release

- [ ] `pnpm exec monti doctor` (with `--origin http://localhost:3000` when S3 is set).
- [ ] Direct upload to the bucket when S3 is set (the browser sends the file to the bucket, not the site).
