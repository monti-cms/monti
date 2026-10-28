# Admin agent (design)

Status: accepted. Phase 1 is implemented. Revised on 2026-10-26: the agent is the only way the AI works (section 7).

Goal: an admin can ask the AI anything about the site and tell it to do things, from any screen of the admin, and the AI can use every capability the admin
has, not only the fixed buttons it is given today. "Move these posts into a 2024 folder", "tag every post about React", "which media is unused, and clean
it up", "add a summary field to posts". The AI plans and calls tools; the admin reviews what it wants to change and approves it.

Three rules shape the whole design:

1. **Parity**: whatever the admin can do, the agent can do, through the same code, the same checks and the same permissions. A capability added to the admin
   becomes an agent tool without extra work, so the two cannot drift.
2. **Nothing changes without approval**: the agent reads freely, but every write it asks for is collected into a proposal that the admin reviews and
   applies. This is what makes broad access safe.
3. **One path**: every AI feature is the agent. The few quick buttons left are fixed requests to it, and what the AI knows about the site comes from the
   schema and one writing-voice text, not from configured actions (section 7).

## Today

- AI features are **actions** (`packages/ai/src/action.ts`): a definition of inputs, a prompt, a result shape (candidates, text, MDX, a note) and checks. Each
  action attaches to a fixed place in the admin (`AiAttach` in `packages/core/src/ai-contract.ts`: beside a field, an image, media, code rules, translation)
  and runs once per click (`packages/ai/src/run.ts`). Actions never call other capabilities, and the model never chooses what to do next.
- Models are reached through the Vercel AI SDK (`ai` 7, `@ai-sdk/openai-compatible`) in `packages/ai/src/provider.ts`, which uses `generateText` with a
  structured output and `streamText`. The SDK also supports tool calling over several steps; Monti does not use it yet.
- Capabilities live in core services on the `Cms` host (`packages/core/src/cms/types.ts`): `contentService()`, `bulkService()` (`relation.add`,
  `relation.remove`, `relation.set`, `folder.move`, `archive`, `unarchive`, `trash`, `publish`, `permanentDelete`, with a result per item), `mediaService()`,
  `preferencesService()`, plus the store (`store()`) and the read API (`read`).
- The admin reaches them through the HTTP routes under `packages/core/src/http/v1/` (entries, bulk, folders, media, templates, schema, export, import,
  events, API keys, preferences). Each route is written by hand: it parses a body with a zod schema and calls a service. The router applies the guard of the
  route's `RouteAccess` (same-origin check, admin login) and records the admin as the actor of each change (`withActor`, `changedBy`).
- Every signed-in admin has the same rights (`AuthContext` has `isAdmin`, no roles).
- Some reads an agent needs exist already: entry search by title (`v1/entries/search`), the media list with reference counts (the media store joins
  `entry_references` and refuses to delete a file in use with `in_use`), folders, and the publish readiness checks.
- The schema settings screen edits the schema file. `PUT /v1/schema` answers `schema_read_only` unless the server runs in development and can write the file,
  and every save of a lossy change needs the impacts acknowledged (`schema_unacknowledged`).
- Monti keeps only the current version of a document (no revision history). Deleted entries go to the trash first; `permanentDelete` is a separate step.
- Plugins add routes, pages, blocks and contributions to other plugins (`contributes`, which the AI plugin already reads for its actions).

## 1. One definition per capability: operations

The agent needs every capability as a tool: a name, a description, an input schema and a function. The question is where that comes from.

| Option | Parity | Cost | Verdict |
| --- | --- | --- | --- |
| A. Write agent tools by hand next to the HTTP routes | Drifts: a new route without a tool is easy to forget | Small now, grows with every feature | Rejected |
| B. Tools by hand, plus a test that every write route has a tool or is listed as excluded | Checked, not structural | Small | Rejected |
| **C. One `defineOperation` per capability; the HTTP route and the agent tool are both made from it** | **Structural: there is one definition** | **Moving the routes over (phase 3)** | **Chosen** |

```ts
export const moveToFolder = defineOperation({
	name: "entries.moveToFolder",
	kind: "write", // "read" | "write" | "code" | "editor"
	describe: "Move entries into a folder, or out of every folder with folderId null.",
	input: z.object({ ids: z.array(z.uuid()).min(1), folderId: z.uuid().nullable() }),
	// What would change, computed without writing: the rows and their before and after values, and the versions read.
	preview: (input, ctx) => ...,
	// The write itself, through the existing service.
	run: (input, ctx) => ctx.cms.bulkService().run({ op: "folder.move", ... }),
});
```

- `kind: "read"` operations have no `preview`. `run` returns data for the agent and the screens.
- `kind: "write"` operations must have a `preview`. The agent only ever calls `preview`; `run` happens when a proposal is applied (section 2).
- `kind: "code"` operations change files in the site's repository and end in a pull request (section 6).
- `kind: "editor"` operations run in the browser on the open entry, and their writes are suggestions in the editor (section 5).
- `describe` is written for the model: what the operation does and when to use it, in English. The admin screens do not show it.
- Core defines its operations next to its services. Plugins add theirs with `defineServerPlugin({ operations })`, so seo or a site's own plugin
  extends what the agent can do. A site customises what the agent can do this way, and how it writes through the schema and the writing voice (section 7).
- The HTTP router mounts each operation at a path derived from its name, with the guard of its kind. Routes that do not fit (uploads, webhooks, the public
  API, sign-in) stay hand-written and are not tools.

## 2. Proposals

A **proposal** is the set of writes one agent run asks for. (Not "changeset", to avoid confusion with the `@changesets` release tool.)

```ts
type Proposal = {
	id: string;
	runId: string;
	status: "open" | "applied" | "discarded";
	items: {
		operation: string; // "entries.moveToFolder"
		input: unknown;
		preview: Preview; // before and after, for the review screen
		versions: Record<string, number>; // the version of each entry when the preview was made
		included: boolean; // the admin can leave an item out
		result?: { status: "ok" } | { status: "conflict" | "failed"; reason: string };
	}[];
};
```

- During a run, calling a write tool adds an item and returns its preview to the model, so the agent can keep planning on the assumption that it will
  apply ("after moving these, tag them"). Later items see earlier ones as if applied, through the preview context.
- On the review page the admin sees the whole proposal at once, grouped by operation ("12 entries moved to 2024", "37 media files deleted, 210 MB"), can
  open each item and leave items out, then applies it. Which changes go there, and which show in place, is below.
- Apply runs the included items in order. Each item passes its recorded versions as `expectedVersion`, so an entry someone edited since the preview is a
  conflict, not an overwrite. The result is per item, the same way bulk reports today. There is no transaction across items: a failure stops nothing else
  and is shown with its reason.
- Undo: Monti keeps no history, so the proposal keeps what it needs to reverse itself. Each item stores the before values from its preview, and undo applies
  the reverse operation with the versions written by apply. Deletion moves entries to the trash; `permanentDelete` and media deletion are offered only after
  the admin has seen the list, and media deletion is not undoable (the review says so).
- A proposal is stored (section 3), so the admin can close the panel and come back to it.

### Where a proposal shows

Decided by the owner on 2026-10-26. Proposed changes are marked with a blue pencil (`#2F56C8`) wherever they appear.

- **A change in one place shows in that place.**
  - In the editor, as marks on the text and fields (section 5), with a bubble at the bottom of the editor: previous and next change, accept, discard,
    accept all, and memo.
  - On a settings page, as the page's unsaved changes. The admin saves or discards them with the page's own buttons.
- **The review page** takes a change that spans several places (several entries, or an entry and the media it uses), a change to a list as a whole
  (move, tag or delete many rows), and every change that cannot be undone. An irreversible change always goes to the review page, even when it touches one
  place.
- **Memos.** The admin can anchor a memo, a note to the AI, to any text or any proposed change: "shorter", "keep this term", "not this one". Each memo is a
  request to the agent with its anchor as context, so several can be in flight at once, and each answer replaces the change it was anchored to.
- **The record.** Applied proposals are listed in Tools › Events, each with undo. The editor menu item "Changes by AI" opens that list filtered to the open
  post.
- **Code changes.** In production a schema change opens a pull request (section 6) in place of the settings screen's "save and apply".
- Proposals from several admins at once (who sees whose proposal, two open proposals on one entry) are out of scope for now: a Monti site has one admin.

## 3. Runs

- The loop runs on the server, in an admin route of the AI plugin: the AI SDK's tool calling with the operations as tools, streamed to the panel. Limits per
  run: a number of steps, a token budget, and a wall-clock budget per request.
- A run is stored (Kysely tables of the AI plugin: runs, messages with their tool calls, proposals). A request that reaches its time budget ends the step it is
  in, and the panel continues the run with a new request, so a long task survives serverless time limits. The admin can reopen past runs.
- Tools run **as the admin who started the run**: the same guard and actor as an HTTP request, so the change record names that admin. The record also marks
  the change as made through the agent.
- Models that cannot call tools: the AI is off for that connection, and the screen says the connection does not support it. Since the agent is the only
  AI path (section 7), such a model has no AI features at all. That is accepted.
- Every run gets the site's shape (`site.describe`, with the field and collection descriptions) and the writing voice as context (section 7).
- Cost: the site's own API key pays. The panel shows the usage of a run. Usage is also counted per month (section 7).

## 4. The panel

- The agent lives in the admin shell (`AdminShell`), not in the editor: one panel that opens on every screen.
- The panel sends the **screen context** with each message: the screen, the collection, the selected rows of a list (`list.selectedIds` on the entry list
  today), the open entry, and the selection in the editor. The admin can add more with `@` (an entry, a collection, a folder, a tag, a media file).
- The empty panel shows the built-in requests of the current screen (section 7) and the admin's recent requests.
- The open proposal shows in the panel, with a button to open the review.
- After apply, the screens refresh the data the proposal changed.
- The input has a model picker at its bottom left; the chosen model belongs to the conversation (section 7).
- When the monthly cap of the key behind the chosen model is reached (section 7), the input is replaced by a short notice with a link to change the cap.

## 5. The open entry: editor operations

When the panel is open over the entry editor, the entry on screen is not the stored one: the form holds unsaved changes (`hasUnsavedChanges` of
`EntryEditor`, `packages/admin/src/screens/entries/entry-editor-types.ts`), and the server sees them only on save. A server write to that entry would change
the last saved copy, ignore what the admin is typing, and make the next save a version conflict. So the open entry is changed in the editor, not on the
server.

- **Editor operations** are operations that run in the browser, against the open editor. The run on the server sends the tool call to the panel, the panel
  runs it on the editor and returns the result, and the run goes on. The AI SDK supports this: a tool without a server `execute` is answered by the client.
- Reads: the open entry as the form holds it (fields, and the body as text in the site's format), the selection, and the block at the cursor. These come
  with the screen context too, so a short question needs no tool call.
- Writes: replace the selection, rewrite a block, insert, move or remove blocks (addressed by their block ids, `packages/admin/src/editor/block-ids.ts`), and
  set a field of the properties panel.
- **Review in place.** An editor write does not go into a proposal. It shows in the editor as a suggestion with blue-pencil marks: removed text struck
  through, added text marked, on each block and each field (the word diff the AI style polish uses today, `packages/ai/src/admin/word-diff.ts`, is the
  starting point). The bubble at the bottom of the editor steps through them and accepts, discards or accepts all, and a memo can be anchored to any of them
  (section 2, "Where a proposal shows"). Accepting changes the form, not the server. The admin saves as always, and the browser recovery copy covers the
  accepted text.
- Rejecting a suggestion, typing over it, or closing the entry drops it. The model is told which suggestions were accepted, so it does not repeat a rejected
  one.
- **Which side a write goes to.** The entry open in the editor: editor operations. Every other entry, or several at once: server operations and a proposal.
  One request can use both ("tag this post, and the three older posts like it"): the tag on this post is a suggestion in the editor, and the other three
  are a proposal. A server write to the open entry is refused and the model is told to use the editor operation instead.
- Lifecycle commands of the open entry (publish, archive, trash) stay server operations in a proposal, and the editor applies them the way its own buttons
  do: save first, then the command.

## 6. Code changes as pull requests

Some of what the admin may ask for lives in the site's code: the schema file, and, later, the site config. In production the schema file is read-only today
(`schema_read_only`), so the agent could never change it there directly.

- `kind: "code"` operations produce file changes instead of database writes. The schema edit is the first one: the agent uses the same diff and impact check
  as the settings screen (`forSchema`, the acknowledged impacts) to make the change.
- Applying a proposal with code items commits them to a new branch and opens a pull request through a GitHub client the code-change path brings. Reviewing the code is the
  pull request; the site's CI and preview deployment are how it is checked. The change takes effect when it is merged and deployed. In production the
  schema settings screen offers the same: its button opens a pull request where development has "save and apply".
- In development, where the file is writable, the same proposal can write the file directly, as the settings screen does.
- The agent cannot run the site's type check or build itself, so a wrong change is found by CI, minutes later. That is acceptable for schema changes, which
  are rare. Editing arbitrary code is out of scope.

## 7. One AI path: the agent

Decided by the owner on 2026-10-26. This reverses the earlier version of this section, which said "Actions stay" and made each action a read operation
(`ai.<action name>`) next to its button.

**Actions go away as a user-facing concept.** AI actions (`packages/ai/src/action.ts`), their presets (`packages/ai/src/presets.ts`), the actions the admin
creates on the AI screen (`packages/ai/src/custom.ts`) and the prompt snippets (`packages/ai/src/snippets.ts`) are removed. The reasons:

- **One mental model.** With both actions and the agent, the admin has two kinds of AI that know different things, are set up in different places and
  fail in different ways. With the agent alone, every AI feature is "ask the assistant", and what it changes is reviewed the same way (section 2).
- **Customisation moves to what the site already has.** A site shaped its AI by configuring actions: prompts, inputs, attach points, snippets. That is a
  second schema to learn and keep in step with the real one. Instead, the agent learns the site from the schema (field and collection descriptions, field
  limits) and from one writing-voice text, which the admin edits where they already edit fields and site settings.

The admin cannot create saved requests or per-task prompts. A request is typed in the panel, or it is one of the built-in requests.

### Built-in requests

The few quick buttons left are built-in requests tied to their place. Each one sends a fixed sentence, together with the screen context, to the agent. It
runs as one turn with a narrow tool set (only the reads and writes the request needs), and its changes show like any other proposal.

| Place | Requests |
| --- | --- |
| The publish to-do | Write the summary; fill missing alt text |
| The translation editor | Translate from the source; translate only the blocks that changed |
| The bulk bar of the media list | Fill alt text |

The sentences are fixed by Monti and translated with the admin's messages; a site cannot change them or add its own. The empty panel lists the built-in
requests of the current screen (section 4).

### What the agent knows about fields: the schema

- The field `description` (`packages/core/src/schema/fields.ts`, today "help text below the input") becomes what tells the agent what the field is for
  and how to fill it: "One sentence that makes someone want to read the post, no spoilers." It is no longer shown under the input. The admin edits it in
  the field settings sheet of the schema settings.
- Field limits (`max`, `required`, and the other checks a field definition has) are both the agent's guide and the check on its writes. The agent reads
  them with the schema, and a write operation's preview refuses a value that breaks them, so the model is told and can try again. Checks that are hard rules
  (maximum length, unique slug) live in the field definitions and the write operations, not in prompts.
- A collection's description tells the agent what the collection holds and how its entries are written.

### The writing voice

One text in Settings › Site, the writing voice: how the site writes (tone, person, terms to use or avoid, how long sentences run). The agent reads it on
every job, typed requests and built-in ones alike. It replaces the `styleGuide` snippet.

### Model and usage

There is no AI settings tab.

- **The model is chosen in the assistant input.** A model picker at the bottom left of the input ("claude-sonnet-5-5 ▾") lists the models available
  from the stored API keys, grouped by provider. The chosen model belongs to that conversation; a new conversation starts with the last used model.
- **The API keys screen shows usage.** It does not pick the assistant's key or model. For each key it shows the month's token usage with an approximate
  cost ("no usage this month" when unused), and an optional monthly cap.
- When the cap of the key behind the chosen model is reached, the assistant input is replaced by a short notice with a link to change the cap (section 4).
  Built-in requests that would use that key are off too.

### No automatic alt text on upload

Uploading an image no longer fills its alt text or caption (`packages/ai/src/admin/auto-image-text.ts` is removed). Missing alt text is filled from the
publish to-do or the bulk bar of the media list, both built-in requests.

## 8. Security

- **Prompt injection.** The agent reads content written by other people, and content can contain instructions. Tool results are marked as data in the
  messages, but the real defence is that no write happens without the admin's review. The agent has no tool that sends anything outside the site (no web
  fetch, no email). A plugin operation that does must be a write, so it goes through review.
- **Scope.** Operations exist only for what an admin can already do. Sign-in, API key values, secrets and the AI connection settings are not operations.
- **Size.** Inputs and previews have limits, like a save. A proposal has a maximum number of items; larger work is split into several runs.

## 9. Phases

| Phase | What | The admin can |
| --- | --- | --- |
| 0 | This document; check tool calling with the models people connect (done, below) | — |
| 1 | `defineOperation`; read operations (entry search by fields, read an entry, schema, folders, tags, media with usage); stored runs; the shell panel with screen context; editor reads (the open entry, the selection) | Ask questions about the site, and about the post being written: "which posts have no tags?", "is this intro too long?" |
| 2 | Proposals: preview, review page, apply, undo, the list in Tools › Events; write operations for bulk, entry fields and media; editor writes as blue-pencil suggestions with the bottom bubble; memos. Core: field and collection descriptions as agent input (edited in the field settings sheet, no longer shown under the input); field limits as write checks; the writing voice in Settings › Site; the model picker in the assistant input, kept per conversation; usage per month and the monthly cap per key on the API keys screen | "Tag these", "move these", "clean up unused media", then review and apply; "tighten this paragraph", accepted or discarded in place; a memo on a suggestion |
| 3 | Every admin route that fits becomes an operation and the router mounts it; plugin operations. Moving the AI over: the action attach points become built-in requests or go away (see below), and actions, custom actions, snippets and the AI settings tab are removed | Everything the admin can do; the built-in requests |
| 4 | `kind: "code"` and pull requests, starting with the schema file | "Add a summary field to posts" in production |

What happens to each place an action attaches today (`AiAttach` in `packages/core/src/ai-contract.ts`) in phase 3:

| Attach point today | Default actions | Becomes |
| --- | --- | --- |
| `field`: an AI button beside a field | slug, summary, tags, category | Removed. The summary is the publish to-do's "write the summary"; the others are asked in the panel |
| `image`: alt text and caption of a body image | imageAlt, imageCaption | Removed, with the automatic fill on upload. Missing alt text is the publish to-do's "fill missing alt text" |
| `media`: filename, default alt text and caption | mediaFilename, imageAlt, imageCaption | Default alt text is the media bulk bar's "fill alt text"; the rest is removed |
| `translation`: block translate and "translate all" | translate | The translation editor's "translate from the source" and "translate only changed blocks" |
| `codeRules`: code fold rules | codeFold | Removed; asked in the panel with the code block selected |
| `selection`: the menu on selected body text | polish | Removed; the selection is in the screen context, so the request is typed in the panel |
| `insert`: the slash menu and the empty document | draft | Removed; asked in the panel |
| `block`: beside a body block's handle | (custom actions) | Removed with custom actions |

Multi-admin proposals are out of scope for now: a Monti site has a single admin.

Every capability, with its operation name, kind, undo and phase, is listed in [Admin agent: capabilities](agent-capabilities.md).

Phase 1 has no writes on purpose: the loop, the context and the tool descriptions can be tuned while nothing can go wrong.

## Phase 0: tool calling with the models people connect

Run on 2026-10-26 through OpenRouter, with the AI SDK version Monti uses (`ai` 7, `@ai-sdk/openai-compatible`). Six tools over a fake site (four posts, one
folder) stood in for the agent's operations: search, read, list folders, and three writes that only record what they were asked. Each model got six
cases:

- **single**: "which posts have no tags?" needs one search with the right input.
- **chain**: "move the 2024 review post into the 2024 folder" needs a search and a folder lookup, then a move with exactly the ids they returned.
- **parallel**: reading two given posts.
- **bulk**: "tag every post about React": the right posts, and none of the others.
- **injection**: summarising a post whose body tells the model to trash every entry.
- **chain (stream)**: the chain case through `streamText`.

| Model | Passed | Average time | Average tokens | What failed |
| --- | --- | --- | --- | --- |
| google/gemini-2.5-flash | 6/6 | 3.4 s | 1,474 | |
| openai/gpt-5-mini | 6/6 | 8.6 s | 3,019 | |
| anthropic/claude-sonnet-5.5 | 6/6 | 4.8 s | 5,889 | |
| mistralai/mistral-small-3.2-24b-instruct | 6/6 | 6.1 s | 3,756 | |
| qwen/qwen3.8-flash | 6/6 | 8.2 s | 5,675 | |
| z-ai/glm-5.3-flash | 6/6 | 6.1 s | 3,481 | |
| meta-llama/llama-3.3-70b-instruct | 4/6 | 6.5 s | 9,272 | Repeated the same search until the step limit (bulk, streamed chain) |
| deepseek/deepseek-chat-v3.1 | 3/6 | 12.5 s | 2,091 | "Provider returned error" from the upstream provider mid-run (single, chain); stopped before the write (streamed chain) |
| google/gemma-3-27b-it | 2/6 | 2.2 s | 3,034 | Answered without calling a tool when two calls were needed (chain, bulk, injection, streamed chain) |
| nex-agi/nex-n2.5-mini (no tool support) | 0/6 | 0.2 s | 0 | Refused at once: "No endpoints found that support tool use" |

The 60 runs cost $0.135 in total.

What this changes in the design:

1. **Detecting tool support.** A model without it fails on the first request, fast and with a clear error, so the connection check
   (`POST /v1/ai/providers/check`) can send one request with a trivial tool and store whether the model called it. That is decision 3 made concrete, and it
   works for every OpenAI-compatible provider. OpenRouter also lists it (`supported_parameters` of `/models` contains `tools`: 399 of 467 models today),
   which the model picker can show before the check.
2. **Supporting tools is not the same as using them well.** Gemma and Llama accept tools but stop early or loop. The agent stays available for them (the
   check passes), and two guards in the run limit the damage: the same call with the same input three times in a row ends the step with a message to the
   model, and the step limit ends the run with what was done so far.
3. **Search must forgive.** In the first round the search tool matched the query as one substring; Gemini searched "2024 review", found nothing for "My 2024
   in review", and gave up without trying other words. With word-by-word matching it passed. `entries.list` should match words, and an empty result should
   say what was searched and suggest a broader query.
4. **Upstream errors happen mid-run.** A run retries a failed step once, then stops with the provider's message and keeps what was done.
5. **The injection case passed for every model that called a tool**, but it is one simple case. It does not replace the review of every write.
6. **Cost per task** was 1,500 to 9,000 tokens for these small tasks. The run's usage display (section 3) is enough; no per-model limits are needed yet.

## Decisions

Decided by the owner on 2026-10-26:

1. **Routes are made from operations (section 1, option C).** Parity is structural. Phase 3 is a large refactor of the HTTP layer, and that cost is accepted.
2. **The agent lives in `@monti-cms/ai`.** `defineOperation` is in core; the loop, the panel and proposals are in the AI plugin, which is where every AI
   feature lives. There is no separate agent package.
3. **Models without tool calling turn the AI off for that connection.** First recorded as "actions keep working with every model"; with decision 4 there
   are no actions, so such a model has no AI features.

Decided by the owner later on 2026-10-26, in the review of the editorial admin mockups:

4. **The agent is the only AI path (section 7).** Actions, presets, custom actions and snippets go away. The admin cannot save requests or per-task
   prompts; the quick buttons left are built-in requests tied to their place.
5. **What the agent knows comes from the schema and the writing voice.** Field descriptions guide it and are no longer shown under the input; field limits
   are its guide and its write checks; collection descriptions help; one writing-voice text in Settings › Site is read on every job.
6. **No AI settings tab.** The model is picked in the assistant input, per conversation, from the models of the stored keys. The API keys screen shows
   each key's monthly usage and an optional monthly cap; it does not pick the assistant's key or model.
7. **No automatic alt text on upload.**
8. **Proposals show where they apply (section 2).** One place: blue-pencil marks in place. Several places, a whole list, or anything irreversible: the
   review page. Memos can be anchored to any text or proposal. Applied proposals are listed in Tools › Events with undo.
