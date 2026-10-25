# Admin agent (design)

Status: accepted, not implemented.

Goal: an admin can ask the AI anything about the site and tell it to do things, from any screen of the admin, and the AI can use every capability the admin
has, not only the fixed buttons it is given today. "Move these posts into a 2024 folder", "tag every post about React", "which media is unused, and clean
it up", "add a summary field to posts". The AI plans and calls tools; the admin reviews what it wants to change and approves it.

Two rules shape the whole design:

1. **Parity**: whatever the admin can do, the agent can do, through the same code, the same checks and the same permissions. A capability added to the admin
   becomes an agent tool without extra work, so the two cannot drift.
2. **Nothing changes without approval**: the agent reads freely, but every write it asks for is collected into a proposal that the admin reviews and
   applies. This is what makes broad access safe.

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
- `git-sync` has a GitHub client (`packages/git-sync/src/github/client.ts`) that can create blobs, trees, commits, branches and pull requests.
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
	kind: "write", // "read" | "write" | "code"
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
- `kind: "code"` operations change files in the site's repository and end in a pull request (section 5).
- `describe` is written for the model: what the operation does and when to use it, in English. The admin screens do not show it.
- Core defines its operations next to its services. Plugins add theirs with `defineServerPlugin({ operations })`, so git-sync, seo or a site's own plugin
  extends what the agent can do. This is also how a site customises the agent, in line with how it defines AI actions today.
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
- The admin reviews the whole proposal at once, grouped by operation ("12 entries moved to 2024", "37 media files deleted, 210 MB"), can open each item and
  leave items out, then applies it.
- Apply runs the included items in order. Each item passes its recorded versions as `expectedVersion`, so an entry someone edited since the preview is a
  conflict, not an overwrite. The result is per item, the same way bulk reports today. There is no transaction across items: a failure stops nothing else
  and is shown with its reason.
- Undo: Monti keeps no history, so the proposal keeps what it needs to reverse itself. Each item stores the before values from its preview, and undo applies
  the reverse operation with the versions written by apply. Deletion moves entries to the trash; `permanentDelete` and media deletion are offered only after
  the admin has seen the list, and media deletion is not undoable (the review says so).
- A proposal is stored (section 3), so the admin can close the panel and come back to it.

## 3. Runs

- The loop runs on the server, in an admin route of the AI plugin: the AI SDK's tool calling with the operations as tools, streamed to the panel. Limits per
  run: a number of steps, a token budget, and a wall-clock budget per request.
- A run is stored (Kysely tables of the AI plugin: runs, messages with their tool calls, proposals). A request that reaches its time budget ends the step it is
  in, and the panel continues the run with a new request, so a long task survives serverless time limits. The admin can reopen past runs.
- Tools run **as the admin who started the run**: the same guard and actor as an HTTP request, so the change record names that admin. The record also marks
  the change as made through the agent.
- Models that cannot call tools: the agent is off for that connection, and the screen says the connection does not support it. Actions keep working with
  every model.
- Cost: the site's own API key pays. The panel shows the usage of a run.

## 4. The panel

- The agent lives in the admin shell (`AdminShell`), not in the editor: one panel that opens on every screen.
- The panel sends the **screen context** with each message: the screen, the collection, the selected rows of a list (`list.selectedIds` on the entry list
  today), the open entry, and the selection in the editor. The admin can add more with `@` (an entry, a collection, a folder, a tag, a media file).
- The open proposal shows in the panel, with a button to open the review.
- After apply, the screens refresh the data the proposal changed.

## 5. Code changes as pull requests

Some of what the admin may ask for lives in the site's code: the schema file, and, later, the site config. In production the schema file is read-only today
(`schema_read_only`), so the agent could never change it there directly.

- `kind: "code"` operations produce file changes instead of database writes. The schema edit is the first one: the agent uses the same diff and impact check
  as the settings screen (`forSchema`, the acknowledged impacts) to make the change.
- Applying a proposal with code items commits them to a new branch and opens a pull request, through the git-sync GitHub client. Reviewing the code is the
  pull request; the site's CI and preview deployment are how it is checked. The change takes effect when it is merged and deployed.
- In development, where the file is writable, the same proposal can write the file directly, as the settings screen does.
- The agent cannot run the site's type check or build itself, so a wrong change is found by CI, minutes later. That is acceptable for schema changes, which
  are rare. Editing arbitrary code is out of scope.

## 6. AI actions

Actions stay, and each one also becomes a read operation (`ai.<action name>`): the agent can ask for "a summary of this post" through the same definition,
inputs and checks as the button, and put the result into a proposal with a write operation. The buttons remain the quick path for one field, the way an
editor keeps both autocomplete and a chat.

## 7. Security

- **Prompt injection.** The agent reads content written by other people, and content can contain instructions. Tool results are marked as data in the
  messages, but the real defence is that no write happens without the admin's review. The agent has no tool that sends anything outside the site (no web
  fetch, no email). A plugin operation that does must be a write, so it goes through review.
- **Scope.** Operations exist only for what an admin can already do. Sign-in, API key values, secrets and the AI connection settings are not operations.
- **Size.** Inputs and previews have limits, like a save. A proposal has a maximum number of items; larger work is split into several runs.

## 8. Phases

| Phase | What | The admin can |
| --- | --- | --- |
| 0 | This document; check tool calling with the models people connect (OpenAI-compatible providers differ) | — |
| 1 | `defineOperation`; read operations (entry search by fields, read an entry, schema, folders, tags, media with usage); stored runs; the shell panel with screen context | Ask questions about the site: "which posts have no tags?" |
| 2 | Proposals: preview, review screen, apply, undo; write operations for bulk, entry fields and media | "Tag these", "move these", "clean up unused media", then review and apply |
| 3 | Every admin route that fits becomes an operation and the router mounts it; actions as operations; plugin operations | Everything the admin can do |
| 4 | `kind: "code"` and pull requests, starting with the schema file | "Add a summary field to posts" in production |

Every capability, with its operation name, kind, undo and phase, is listed in [Admin agent: capabilities](agent-capabilities.md).

Phase 1 has no writes on purpose: the loop, the context and the tool descriptions can be tuned while nothing can go wrong.

## Decisions

Decided by the owner on 2026-10-26:

1. **Routes are made from operations (section 1, option C).** Parity is structural. Phase 3 is a large refactor of the HTTP layer, and that cost is accepted.
2. **The agent lives in `@monti-cms/ai`.** `defineOperation` is in core; the loop, the panel and proposals are in the AI plugin, because actions become tools
   of the same agent. There is no separate agent package.
3. **Models without tool calling turn the agent off for that connection.** Actions keep working with every model.
