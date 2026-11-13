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
| `monti/blocks/` | The ten blocks and marks `monti add` copied in (the site owns them) |
| `seed/blocks.ts` | The 보기 모음 entries for those blocks |
| `seed/variants.ts` | The 보기 모음 entries: each block used in its different ways, one heading per example |
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
| 코드 블록 도구를 모두 쓴 글 (`code-tools`) | published | Line effects, regex rules, line and word folds, tooltips in code, code links and several languages in one entry |
| 끊긴 코드 링크가 있는 초안 (`broken-code-link`) | draft, blocked | A code link whose line is gone: a publish to-do |
| 보관된 코드 글 (`archived-code`) | archived | A code block that can only be read |
| The ten entries of the 보기 모음 folder | published | Each block used in its different ways: text and lists, tables and footnotes, pictures and files, the code's head and languages (with an English translation), the code's line effects and folds, the code's rules, marks and links, callouts and collapsibles, tabs and columns, formulas, diagrams and charts (unreadable ones too), the code explorer with text colours and tooltips. Each example has a heading that says what it shows |

Also: folders 안내 › 국내 and 소식 for articles; media folders 표지 › 2026, 인물, 문서 with five pictures, a PDF and a CSV, a picture used
nowhere at the top, and in the trash a picture and the folder 지난 행사 with a file in it; six tags (English for all, Japanese for two; 겨울 used by
nothing) and one made from an article's field; two people (one in English); two series; the template 여행 안내서; and failed deliveries to the broken hook (seeded while no server ran, so they failed with `ECONNREFUSED`; sent
again under `pnpm dev`, they fail with its 503).

## QA checklist

Each feature as a person using Monti would recognise it. Tick what you have tried.

### Writing

- [ ] Make a new entry
- [ ] Start a new entry from a template (template: 여행 안내서)
- [ ] Write a title and a body and save
- [ ] See the unsaved changes and undo them
- [ ] Be asked when leaving with unsaved changes
- [ ] Compare what differs when the same entry was changed elsewhere
- [ ] Publish: with the publish date kept, or published again with today's date
- [ ] See the to-dos before publishing and go to each (영상 주소가 빠진 초안, 주소 없는 초안)
- [ ] An entry changed after publishing shows as changed (숲 사진첩)
- [ ] Preview an entry on the site before publishing
- [ ] Duplicate an entry
- [ ] Archive and unarchive an entry (지난 봄 소식)
- [ ] An archived entry can only be read
- [ ] After changing an address and publishing again, the old address goes to the new one

### Body editor

- [ ] Add a paragraph, headings (three sizes), a bulleted list, a numbered list, a checklist, a quote, code, a table and a divider
- [ ] Set bold, italic, underline, strike, code, superscript and subscript
- [ ] Link to another site, and to another entry of this site
- [ ] Add a footnote
- [ ] Align a paragraph to the center or the right
- [ ] Add rows and columns to a table, and change a column's width
- [ ] Add a picture and set its size, alignment, crop, rotation, caption and alt text
- [ ] Mark a picture as decorative
- [ ] Add a file to download
- [ ] Drag a block by its handle to move it
- [ ] Drag a box over several blocks to pick them, then move or delete them together
- [ ] View as MDX

### Fields

- [ ] Write in a text field, a multi-line one, and one with a character limit
- [ ] Pick in a one-choice field and a many-choice field
- [ ] Pick a cover picture and an attached file
- [ ] Pick one series
- [ ] Pick several tags and reorder them
- [ ] Type a tag name that does not exist and make it there
- [ ] Pick an author and see the entry under that person's articles too (이바다)
- [ ] Pick a format and see that format's fields: video, gallery, link
- [ ] Inside the link format, pick external or internal
- [ ] Changing the format says the other format's values will go
- [ ] Turn on 맨 위에 고정 and write its note
- [ ] In the SEO tab, set the search title, description, share image, hide from search and canonical address, and see the preview

### Lists

- [ ] Filter by state, topic, season, tag and language
- [ ] Search
- [ ] Sort by pressing a column's name
- [ ] Add, hide, reorder and resize columns
- [ ] With many columns the titles stay, and the table scrolls sideways
- [ ] Change how many rows a page shows, and turn pages
- [ ] Pick several rows and publish, archive, change tags, move to a folder or put them in the trash at once
- [ ] Open a row's menu with a right click or its ⋯
- [ ] Export the picked entries
- [ ] An empty list says what to do

### Folders

- [ ] Make an entry folder, rename it, move it into another (안내, 국내, 소식)
- [ ] Move entries into a folder
- [ ] Deleting a folder puts it in the trash with its entries

### Tags and items

- [ ] See how many entries use each tag
- [ ] Filter the tags no entry uses (겨울)
- [ ] Merge two tags
- [ ] Edit a tag's name in every language in one panel

### Media

- [ ] Upload by dragging files in or with Upload
- [ ] Make folders and move files into them (표지, 2026, 인물, 문서)
- [ ] Switch between the grid and the list
- [ ] Filter by kind and by not used, search and sort (쓰지 않는 그림)
- [ ] Rename a file and see where it is used
- [ ] Replace a file: every place that uses it shows the new one
- [ ] A picture with no alt text is a to-do before publishing
- [ ] Without a storage, the admin says what cannot be done

### Translations

- [ ] Add a language and start a translation
- [ ] For each block left, translate it or keep the source's words (블록과 서식을 모두 쓴 글 in Japanese)
- [ ] A translation can be published only when every block is decided
- [ ] A translation whose source changed shows the changed and added blocks, to update or keep (항구를 걷는 영상 in English)
- [ ] Fields written per language, fields that follow the source and fields shared by all languages look different
- [ ] See in the list's language column which languages an entry has
- [ ] Add or remove the site's languages, and change how an address shows the language

### Assistant

- [ ] With an API key in, ✦ opens
- [ ] Ask for a change, get a proposal, include or leave out each item, and apply
- [ ] Undo an applied proposal whole
- [ ] In the editor, have it fill a field, translate, or redo one proposal
- [ ] Hand work to ✦ from the list, the trash, the activity log and settings
- [ ] Reopen and delete past conversations
- [ ] Pick the model and the quick-task model

### Trash

- [ ] Restore an entry, a picture and a folder from the trash (휴지통에 넣은 글, 지운 배너, 지난 행사)
- [ ] Delete for good, and empty the trash
- [ ] A published entry put in the trash leaves the site, with its translations
- [ ] An entry in the trash can only be read
- [ ] See the days left

### Activity log and deliveries

- [ ] Everything done is a line in the log
- [ ] Filter by kind, delivery state, date and entry, and search
- [ ] Undo something done
- [ ] Failed deliveries show in the sidebar and in the banner at the top
- [ ] Send again, send all again, cancel a delivery
- [ ] A delivery reaches a working webhook (see `/hooks/ok`)

### Settings

- [ ] Change the site's name and its writing rules
- [ ] Make a collection; add, remove and move fields; make a group
- [ ] Make a field required, many-valued or per language
- [ ] Add, remove and rename a format's options
- [ ] Review what changes before saving, then save and apply
- [ ] Preview the property panel
- [ ] Pick the blocks and marks the editor offers, per collection
- [ ] A plugin's tab is locked
- [ ] Change the screen's language
- [ ] Switch the screen mode: light, dark or system

### Tools

- [ ] Make, edit, duplicate and delete templates
- [ ] Add, rename and remove API keys, and see their use
- [ ] Take a backup, with or without the media files
- [ ] Restore a backup into an empty site with a command
- [ ] Import what you wrote: an MDX file (`seed/import/walking-notes.mdx`), matched to fields

### Sign-in and frame

- [ ] Make the admin on the first visit, sign in and sign out
- [ ] Reset a forgotten password with a command
- [ ] See each collection's count, the trash's and the failed deliveries in the sidebar
- [ ] Collapse and expand the sidebar
- [ ] On the live site the structure cannot be changed

### The site

- [ ] The first page shows articles, tags, people and series
- [ ] An article's page draws its fields and every block of its body
- [ ] Move between the Korean, English and Japanese pages (Japanese: 사막의 밤하늘)
- [ ] An item with no translation shows in Korean instead
- [ ] Tag pages and people pages
- [ ] Publishing changes the site at once
- [ ] End a preview from its bar
- [ ] Search results and shared links use the SEO values

### Code blocks

- [ ] Pick a code block's language
- [ ] Add and remove a file name
- [ ] Turn line numbers on and off
- [ ] Pick lines by their numbers and set a line effect: highlight, focus, added, removed, warning, error
- [ ] Fold lines, leave a fold open from the start, fold inside a fold
- [ ] Set bold, italic, underline, strike, a tooltip or a fold on words by a regex rule: over the whole code, on one line
- [ ] Put a tooltip on words in code
- [ ] Fold words in code
- [ ] Link words of the text to lines of code (code line link), and go to those lines
- [ ] A broken code link is a to-do before publishing (끊긴 코드 링크가 있는 초안)
- [ ] Copy the code
- [ ] Code in a language not on the list shows as it is
- [ ] On the site, code is coloured, and its line effects and folds show
- [ ] On the site, open folded lines and folded words, and see the tooltips
- [ ] On the site, pointing at a code link lights its lines, and pressing it goes there
- [ ] On the site, copy the code
- [ ] The different uses are in the three code entries of the 보기 모음 folder

### Blocks package

- [ ] Add a callout and set its kind (note, tip, info, warning, danger) and title
- [ ] Put a list, code, a table or a picture inside a callout
- [ ] Add tabs; add, remove and rename tabs
- [ ] Set which tab shows first
- [ ] Add columns; add a column, drag a column's width, make them even
- [ ] Put a picture, code or a callout inside a column
- [ ] Add a collapsible, write its title, and set whether it starts open
- [ ] Put collapsibles and callouts inside each other
- [ ] Write a formula and see it drawn
- [ ] A formula that does not read shows why and is a to-do before publishing
- [ ] Write a diagram and see it drawn: flowchart, sequence, state, entity, class, Gantt, pie, mind map
- [ ] A diagram that does not read shows why
- [ ] Add a chart, change its kind (bar, line, area, pie) and edit its data
- [ ] A chart that does not read shows why and is a to-do before publishing
- [ ] Add files and folders to a code explorer, and set the file it opens first
- [ ] Link text to a hidden file of a code explorer
- [ ] Give words a colour and a background colour
- [ ] Put a tooltip on words
- [ ] On the site, switch tabs, open collapsibles, pick a code explorer's file and see tooltips
- [ ] The compare and the review show where a block's values changed
- [ ] The different uses are in the four block entries of the 보기 모음 folder
