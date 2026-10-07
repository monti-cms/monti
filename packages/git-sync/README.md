# @monti-cms/git-sync

English | [한국어](README.ko.md)

Two-way sync of **published entries** with files in a GitHub repo: a separate content repo, or the `content` folder of a site repo (Astro, Hugo, ...). Publishing commits the entry's file (or opens a pull request); a change pushed to the repo comes back to the CMS. If an entry changed on both sides, nothing is merged: the admin lists the conflict with a diff and a person picks a side.

- Talks to GitHub through the API with a token and a webhook, so it works on serverless hosting. No checkout, no `git` binary.
- Delivered through the core's event outbox (`afterCommit`): a failed push is retried, not lost.
- The text of a file comes from a format plugin (`mdx` by default) with `purpose: "sync"`, so what is written can be read back.
- The GitHub token and the webhook secret are saved on the plugin's admin screen, encrypted with the server config's `secret` (`cms.secrets("git-sync")`). They are never in config.

```ts
// cms.config.ts
import { gitSync } from "@monti-cms/git-sync";
import { mdx } from "@monti-cms/mdx";

export default defineConfig({
	// …
	plugins: [
		mdx(),
		gitSync({
			targets: [
				{
					repo: "acme/site",
					branch: "main",
					folder: "content",
					collections: ["post", "memo"],
					path: "{collection}/{slug}.{locale}.{ext}",
					mode: "commit",
				},
			],
		}),
	],
});
```

Then run `monti migrate` (it creates the plugin's storage), open `/<admin path>/git-sync`, and follow "Setting it up" below.

## Config

`gitSync({ targets, enabled?, debounceMs?, client? })`

| Option | Meaning |
| --- | --- |
| `targets` | Where entries are synced to (below). Each target is synced on its own |
| `enabled` | `false` registers nothing (no screen, hooks or routes), so a config can carry the plugin switched off. Default `true` |
| `debounceMs` | Publishes that arrive within this many milliseconds of the last commit wait in a queue and go out together in one commit. A publish after a quiet period is committed at once. `0` commits every publish at once. Default `2000` |
| `client` | Makes the GitHub client. For tests and hosts that reach GitHub another way (`@monti-cms/git-sync/testing` has a fake). Server only |

A target:

| Option | Meaning |
| --- | --- |
| `repo` | `owner/name` of the GitHub repo |
| `branch` | The branch to sync with. Default `main` |
| `folder` | Folder of the repo the files live in (`content`). Default: the whole repo |
| `format` | Name of the format the files are written in (`cms.formats()`); it must be able to import. Default `mdx` |
| `path` | Where a file goes, relative to `folder`. Placeholders: `{collection}`, `{slug}`, `{locale}`, `{id}` (the entry id), `{ext}` (the format's extension). It has to contain `{slug}` or `{id}`, `{collection}` when the target has several collections, and `{locale}` when the site has several languages. Default `{collection}/{slug}.{locale}.{ext}`. A Hugo-style layout: `{collection}/{slug}/index.{locale}.md` |
| `collections` | The collections whose published entries are synced |
| `mode` | `"commit"` (the default) commits to the branch. `"pr"` commits to `prBranch` and opens or updates a pull request, which merges itself once checks pass when the repo allows auto-merge |
| `prBranch` | The branch `"pr"` mode works on. Default `monti/publish` |
| `id` | Name of the target (it keys the saved state). Default: `owner-name`, with the folder appended |
| `apiUrl` | REST API root of GitHub Enterprise Server (`https://git.example.com/api/v3`) |

The config is checked when the site config is created: a missing collection, a path that cannot tell entries apart, or a collection field named like a front matter key git-sync writes (`slug`, `date`, `lastmod`, `monti`) is an error naming the target.

## Setting it up

1. **Token.** Create a fine-grained personal access token on GitHub with **read and write** access to *Contents* and *Pull requests* of the repo (a classic token with `repo` scope also works). On the Git sync screen, Settings tab, save it. It is stored encrypted and shown only as its last four characters. The server config needs a `secret` (`CMS_SECRET`); without one nothing can be saved.
2. **Webhook** (to get changes back). In the repo: Settings, Webhooks, Add webhook. Payload URL: the one the Settings tab shows (`https://<site>/api/cms/v1/git-sync/webhook`), content type `application/json`, only the **push** event, and a secret: use "Generate" on the Settings tab, save it there, and paste the same value into GitHub. The route checks `X-Hub-Signature-256` against that secret and refuses anything else. The site must be reachable from GitHub.
3. **First sync.** `monti git-sync:push --all` writes every published entry to the repo (below).

Without the webhook, "Pull now" on the screen and `monti git-sync:pull` (for a cron job) bring changes in.

## The file

One file per published entry and language. YAML front matter, a blank line, and the body written by the target's format:

```
---
title: Hello world
summary: |-
  A short introduction
  on two lines.
tagIds:
  - typescript
  - testing
slug: hello-world
date: 2026-10-07T09:00:00.000Z
lastmod: 2026-10-08T10:30:00.000Z
monti:
  id: 8a3b5c1e-0d2f-4e6a-b7c8-9d0e1f2a3b4c
  collection: post
  locale: en
  refs:
    tagIds:
      - 1f0c6a52-8d1e-4c7a-9f0b-2a3b4c5d6e7f
      - 9d2e4b70-3c1a-4f58-8e6b-7a0c5d1e2f34
---

## Heading

A paragraph with **bold** and a [link to another post](/posts/another-post).
```

- **Fields** of the collection (`title`, `summary`, tags, ...) are top-level keys, as they are stored. A **relation is written as the slug** of the entry it points to (a list of slugs for a many-relation), which is what an Astro or Hugo template needs; the target is the published entry in the file's language, else the source's (a target that is not published is written as its id). The **exact ids are under `monti.refs`**, so the file imports back to the same entries. The per-language names of a record collection (category, tag) are the nested `translations` mapping.
- `slug`, `date` (published) and `lastmod` (modified) are the keys a static site generator reads. `date` and `lastmod` are written for the site and **ignored on import**.
- `monti` names the entry: `id`, `collection`, `locale`, for a translation `translationOf` (the id of its source), and the relation `refs` (`{ tagIds: [uuid, ...], categoryId: uuid }`). It pairs a file with its entry when the file is moved.
- **Relations on import.** A field takes its ids from `monti.refs` when they still match the slugs written in the field (a target renamed since is still found by its id). When the slugs were edited, or the file was written by hand and has no `refs`, each slug is looked up in the field's target collection (published first, then drafts; a former slug works too). A slug no entry has is an import error naming the field and the slug (the file is listed in the pull's errors and nothing is written). Slugs of the targets are written when the entry is published, so a target renamed later shows its old slug in the file until the entry is published again; the ids keep it correct.
- **The body** is the stored document written by the format with `purpose: "sync"`: internal links are the real path of their target (an unresolved one keeps its id), so importing the text gives the same document back. Core does the same for the admin export.

An entry written to a file and imported again gives the same content hash: the tests check it with fields, relations (slugs and ids), a code block, a list and an internal link.

The path follows the slug (it is what `path` says). To rename an entry in git, change its `slug` in the front matter; the file is renamed to match. A file moved with `git mv` is paired with its entry by `monti.id` and put back where the entry's address says.

## Out: CMS to repo

An `afterCommit` event of a synced collection puts the entry in a queue (saved in the plugin's storage, one item per entry and target), and the queue is committed with the git data API (blob, tree, commit, update ref). The entry is read **as it is now**, not as the event saw it, so a repeated or late event does no harm.

| Change | Result |
| --- | --- |
| published (also: restored) | the file is written, or updated |
| the published slug changed | the file is renamed (the old path is deleted in the same commit) |
| unpublished, archived, trashed, deleted | the file is deleted |
| saved (a draft) | nothing: the file holds the published version |

- **Batching.** The first publish after a quiet period (`debounceMs`) is committed at once. Publishes that follow inside the window are queued and go out in one commit when the window ends. The event of a queued entry is **deferred** (the subscriber returns `{ retryAt }`, see "Event delivery" in the core README): it is rescheduled for the end of the window, and it is not a failure, so it is not listed on the Events screen, does not count in its badge, uses no attempt and cannot dead-letter. Nothing runs in the background on serverless hosting, so the deferred events are delivered when the outbox is next run (the next write, `monti events:retry`, a cron); a process that keeps running flushes by itself when the window ends. The commit message lists what is in it.
- **`"pr"` mode.** The commit goes to `prBranch`. If a pull request from it is open, it is added to; otherwise the branch starts again from the head of `branch` and a new pull request opens. Auto-merge is enabled when the repo allows it (otherwise the screen says the pull request waits for a merge).
- **Records.** For each entry the plugin keeps the file path, the git blob sha it last wrote and the content hash of the published entry, in plugin storage. They are what tell a hash mismatch from "nothing to do".
- **Failures throw**, so the outbox retries them (delay 15 s, doubling, 8 tries by default, then a dead letter on the Events screen). The queue keeps the entry meanwhile, and "Commit the queue now" (or the next publish) sends it. **No token saved yet is not a failure:** the events are deferred for an hour (not listed as failed, not in the badge, no attempts used, never dead-lettered), the entries wait in the queue (the Sync tab shows how many), and saving the token on the Settings tab commits the queue and delivers the deferred events at once. Real errors while a token exists (401, an unknown repo, the network) fail and retry as above.
- An entry with an open conflict is not pushed until the conflict is decided.

## In: repo to CMS

A push to a target's branch (the webhook), "Pull now" and `monti git-sync:pull` run the same pull: the files of the folder at the head of the branch are compared with the records. A file whose blob is the one git-sync wrote or read is skipped. For a changed or new file:

1. The file is read through the format into an entry (fields from the front matter, the body from the format). The entry is the one synced from that path, else the one `monti.id` names, else the published entry at the same address; with none, one is created (a translation from its source, `monti.translationOf`).
2. It is written with **the same pipeline as an edit in the admin** (`cms.contentService()`: hooks, validation, references, link and media normalisation) and **published**. A file that fails is listed in the pull's `errors` (the code and the issues the pipeline found) and does not stop the others.
3. The publish this causes is not committed back: the file is already what the entry says.

A file deleted in git does not unpublish the entry (unpublish it in the CMS); its next publish writes the file again.

## Conflicts

The entry is **not written** and a conflict is recorded when:

- both sides changed since the last sync: the published entry's content hash (or slug) differs from the record, and so does the file's blob (`both-changed`);
- the entry has unpublished changes on the server that the import would replace (`unpublished-changes`);
- a file exists in git with different text and the entry was never synced (`unsynced`), which is what `push --all` finds in a repo that already has the files;
- the entry was unpublished or deleted on the server while its file was edited in git (`git-edit-blocks-removal`).

The same check protects the other direction: a publish never overwrites (or deletes) a file that was edited in git; the conflict is recorded instead.

The **Conflicts** tab lists them with a line diff of the **server text** against the **git text**, both written by the format. Two actions, and nothing merges silently:

- **Use git version**: the git text is written to the entry through the pipeline and published, replacing what the server has (a draft with unpublished changes included). A trashed or archived entry comes back.
- **Use server version**: the entry as the server has it is pushed (a commit, or the pull request) over the file in git, or the file is deleted when the entry is no longer published.

A decision is made on the file the person looked at (its blob sha is sent back); if the file changed again, the decision is refused and the screen shows the new text. A conflict also settles itself when the file is edited back to what was last synced: there is nothing left to decide, and what the server changed goes out with the next flush.

## Initial sync

```sh
monti git-sync:push --all [--target <id>]
```

Writes every published entry of the target's collections in one commit (a pull request in `"pr"` mode). Files that already say the same are left alone; files that say something else are conflicts. Run it once when the plugin is set up.

## Commands

All of them load the app like `monti migrate` (`--env-file`, `--no-env-file`, `--server`).

| Command | Does |
| --- | --- |
| `monti git-sync:pull [--target <id>]` | Pulls, like the webhook. Exits 1 if a file could not be applied |
| `monti git-sync:push --all [--target <id>]` | The initial sync |
| `monti git-sync:flush [--target <id>]` | Commits the batch queue now |

## Admin screen

`/<admin path>/git-sync` (sidebar item "Git sync"):

- **Sync**: per target the repo and branch, mode, folder, path pattern, format and collections; how many entries are synced, waiting in the queue or in conflict; the last pull (counts, files with errors, skipped files) and the last commit (files, commit, pull request link, notes); **Pull now** and **Commit the queue now**.
- **Conflicts**: the list with the diff and the two actions. The tab shows how many there are.
- **Settings**: the GitHub token and the webhook secret (write-only), the webhook payload URL.

## API

Under `/api/cms/v1/git-sync/`; all admin only except the webhook, which is public and checks its signature.

| Route | |
| --- | --- |
| `GET status`, `GET/PUT settings` | The screen's data; the token and secret are only ever written |
| `POST pull`, `POST flush` | `{ target? }`: "Pull now" and "Commit the queue now" |
| `GET conflicts`, `POST conflicts/resolve` | `{ target, entryId, resolution: "git" \| "server", gitSha? }` |
| `POST webhook` | GitHub's push webhook (`X-Hub-Signature-256`, `X-GitHub-Event`) |

## Testing a site that uses it

```ts
import { createFakeGitHub, pushPayload, webhookSignature } from "@monti-cms/git-sync/testing";

const github = createFakeGitHub();
const repo = github.repo("acme/site", { main: { "README.md": "# site\n" } });
// gitSync({ client: github.factory, targets: [...] })
repo.files("main"); // path to text
repo.commit("main", [{ path: "content/post/a.en.mdx", text: "..." }]); // an edit in git
repo.merge(1); // merge the open pull request
github.failNext("createCommit"); // GitHub failing, to test the retry
```

## Choices worth knowing

- Only **published** entries sync. Drafts are not synced (a draft-branch workflow is a separate step).
- The file holds the **published** version; relations are slugs with the ids under `monti.refs`; the path is derived from the slug.
- The pull compares blobs (what git has) with records (what git-sync last wrote), not commits, so it does not matter how many pushes a webhook delivery covers, and a missed webhook is made up by the next pull.
- One flush or pull runs per target at a time, across processes (a lock in plugin storage, with an expiry).
- A pull request that is closed without merging leaves the branch with the old file; the next flush that includes the entry (a publish of it, the retry of its event, `monti git-sync:push --all`) puts the version in a new pull request.
- Media files are not synced: an image in a body keeps its media id (`purpose: "sync"`).
