# @monti-cms/ai

English | [한국어](README.ko.md)

The AI plugin for `@monti-cms/core`. It adds named AI actions (generate and decide), AI buttons next to fields, AI translation in the
translation editor, the AI API (`/api/monti/v1/ai/*`), and the AI data in the plugin storage (`cms.plugin("ai").storage`: collections
`settings`, `agent-tools` and `agent-runs`). If you don't register the plugin, none of these exist.

The plugin peers on `@monti-cms/mdx`: installing the AI plugin means installing the MDX package too, and listing `mdx()` in `plugins` next to `ai()`, because its model reads and writes MDX through the `mdx` format ("The model reads and writes MDX").

## Registration

There is no admin AI screen: a key is the connection (see Service keys), and the actions are what the config says. Edits stored by the old screen (action overrides, screen actions, shared texts) are no longer read.

Add `ai()` to `plugins` in `monti.config.ts`. Built-in actions turn on by themselves when there is somewhere to attach them, and
actions added by other plugins (block extensions, SEO extension, and so on) attach by themselves too. List an action by name (key) in
`actions` only to change or turn it off.

```ts
import { aiAction, ai, aiPresets } from "@monti-cms/ai";

plugins: [
	ai({
		siteDescription: "A personal tech blog", // Goes at the very top of every action's instruction. Defaults to "website"
		actions: {
			summary: aiPresets.summary({ maxLength: 120 }), // Replace (same name)
			draft: false, // Turn off
			outline: aiAction({ … }), // Add (new name)
		},
	}),
],
```

An image gets no alt text or caption on its own: the person writes it in the image dialog, or presses "Fill" next to the field, which runs `imageAlt` or `imageCaption` and
puts the result in at once (the first candidate).

### Built-in actions

| Name | Attaches to | Turns on when |
| --- | --- | --- |
| `slug` | Slug field (`fields.slug`) | A collection with a body has a slug field |
| `summary` | Text field with the summary role (`role: "summary"`). Length comes from the field's `max` (160 if unset) | It is in a collection with a body |
| `tags` | Multi-relation field pointing to an item collection (`kind: "item"`). Choices come from the target collection | It is in a collection with a body |
| `category` | Single-relation field pointing to an item collection (`kind: "item"`). Choices come from the target collection | It is in a collection with a body |
| `series` | Backlink field (`fields.backlink`, e.g. the series a post is listed in). Picks one series from the collection the backlink points from, and adds the post to it | It is in a collection with a body |
| `imageAlt`, `imageCaption` | Alt text and caption in the body image and media screens | Always |
| `mediaFilename` | File name in the media screen | Always |
| `translate` | Block translation in the translation editor. The block props to translate come from the block definition (`translatable`) | There are two or more locales |
| `codeFold` | Code block folding rules | Always |
| `polish`, `draft` | Selection menu, insert menu | There is a collection with a body |

- Field actions find the field to attach to by field type, role, and relation target, not by field name (one per collection). Whether it
  picks one or many, and the choices, also come from the field. You can pass a name or collection, as in
  `aiPresets.summary({ field: "excerpt", collections: ["article"] })`. For tags and category, pick the target with
  `choices: "collection"`.
- Instructions assume neither a site type ("blog") nor a language ("Korean"). When the language can't be known from the input (such as
  image alt text), they say "content language", and the runner prepends the content language (the language of the entry being edited,
  or the site default if none) to the top of the instruction.
- If the prompt snippet `styleGuide` (`ai({ snippets: { styleGuide: … } })`) exists, it goes into the polish and draft instructions.
  If not, nothing is added.
- `aiPresets.name(options)` returns a function that builds an action from the site config (`AiActionFactory`). It stays off if there is
  nowhere to attach it.

### Actions added by other plugins

A plugin adds actions with `definePlugin({ contributes: { ai: { actions: { name: definition or factory } } } })` (`AiContribution`). The types of an action, a check and a contribution are in `@monti-cms/core/ai-contract` (types only), so a plugin that adds actions imports them from core and does not depend on this package; this package re-exports them.
It is ignored without the AI plugin, so an extension doesn't need to know about the AI plugin and only reads its types
(`import type`). Adding an existing name is a config error. A site replaces it under the same name or turns it off with `false`. The
block extension's `diagramDraft`, `diagramEdit` (Mermaid), `chartDraft`, and `chartEdit` (charts), and the SEO extension's `seoTitle`
and `seoDescription` attach this way.

- An action is made of inputs (materials), an instruction, a result shape, checks, and where it attaches (`attach`). You can define one
  yourself with `aiAction()`.
- Materials (title, body, image, …) are sent separately rather than inserted into the instruction. The material tag is the input name
  as is (`<title>`, `<block>`, …). Only the locale input can go into `{{name}}` in the instruction.
- Values in a `value`-kind input (the field's current value) are removed from candidates and choices. The input name doesn't matter.
- Attach points are fixed places in the admin UI (next to a field, body image, media, code block, translation, selection menu, insert
  menu, body block). The place must be able to fill the required inputs.
- Running: `POST /api/monti/v1/ai/run { action, input | inputs, env }`. In the admin UI, call by name, as in
  `useAiAction("summary").run({ title, body })` or
  `<AiButton action="summary" input={() => ({ title, body })} onResult={…} />` (`@monti-cms/ai/admin`). Called as they are, any name is
  accepted; `const { useAiAction, AiButton } = aiClient<typeof config>()` gives both with the name, input, and result types of the site config (an unknown name is a type
  error).
- The decide engine (`engine: "decide"`, System One) gets a probability for each choice (`choices`) and returns only those at or above
  the threshold as candidates.

### The model reads and writes MDX

The model reads and writes a text format, and MDX is that format. The admin holds the body as a stored document, so the AI buttons work through the `mdx` format registered in the admin
(`useFormat("mdx")`, `@monti-cms/admin`): the body sent to the model, the selected text and the block to fix are written with the format's `export`, and the MDX the model answers with is read with its
`import` (a text that does not read is kept whole in a box instead of being half converted). The format comes from `mdx()` of `@monti-cms/mdx`, which registers it in the admin. Without it, the actions that work on the body are not offered.

## Result checks

- **Built-in checks**: only those usable by any action. Format (`pattern`), length (`maxLength`), existing values only (`exists`, a
  value among the action's choices), and within choices (`oneOf`, one of a fixed list).
- **Code checks (`defineValidator`)**: checks specific to one action are written as functions and put into the action definition's
  `checks`. The admin screen shows the `label` and only lets you turn them on or off. They run on the server after the built-in checks,
  in the listed order, once per value (one candidate, or the whole text or MDX result). `undefined` or `true` passes; `false` or a
  string rejects (for text and MDX this fails the result, and a string is the reason); `{ detail }` passes and attaches a note next to
  the candidate. The second argument (`AiValidatorContext`) provides the input, collection, locale (default locale if none), the entry
  being edited, the choices, and the core content lookup `content`.
- **Core content lookup (`context.content`)**: the run API fills it with the core public API (`createContentLookup` from
  `@monti-cms/core/server`). Plugins don't read core tables directly. For now it has
  `slugsInUse({ collection, locale, slugs, excludeEntryId? })` (slugs already used in the same collection and locale).
- Default code checks: `uniqueSlug` (no duplicates, for slug suggestions; asks via `content.slugsInUse`),
  `regexRuns(input, { name?, scope? })` (runs the regex, for code block regexes; without a rule name or scope it folds the whole
  document), and `sameStructure(input)` (keeps the structure, for translation). The block extension exports `mermaidSyntax` and
  `chartSyntax` (`@monti-cms/blocks/mermaid/ai`, `/chart/ai`).
- The site config loads check files, so core modules that read the site config (code block reading and the MDX format) must be loaded with
  `await import()` inside `run` (importing them at the top breaks the order in which the config is read).

```ts
import { aiAction, defineValidator, uniqueSlug } from "@monti-cms/ai";

const noBannedWords = defineValidator({
	name: "no-banned-words",
	label: "No banned words",
	run: (value) => (/advertisement|sponsored/i.test(value) ? "Contains a banned word." : true),
});

aiAction({
	label: "Write summary",
	// …
	checks: [{ kind: "maxLength", max: 160 }, noBannedWords],
});

// A check that uses the core content lookup (runs on the server).
const unusedAddress = defineValidator({
	name: "unused-address",
	label: "Unused slug",
	run: async (value, { collection, locale, entryId, content }) =>
		!collection ||
		!(await content.slugsInUse({ collection, locale, slugs: [value], excludeEntryId: entryId })).has(value),
});
```

## Service keys

A key is the whole connection. Keys live in the central API key store (Tools > API keys, `cms.apiKeys` in the core), encrypted with the server `secret`. The plugin offers keys for Anthropic, OpenAI, OpenRouter, Google and an OpenAI-compatible address (an Ollama server, say: the key carries the address and may have no value), all called through their OpenAI-compatible endpoints (`keyServices`). Adding a key checks it with its service first (its model list): a key the service refuses (401, 403) is not saved (`key_rejected`). The value never goes back to the browser, only the key's name, service and last four characters, and the tokens each answer counts are added up per key and month.

- **Models**: the assistant's model is picked in the chat input for each conversation, with a thinking level for a model that can think (sent as the reasoning effort). A new conversation starts on the service's default of the first key that has one (Anthropic `claude-sonnet-5-5`, OpenAI `gpt-5`, Google `gemini-2.5-pro`). The quick-task model (summary, tags, alt text, translation fill: the AI actions) is set once, in the Models section of Tools > API keys (`PUT /api/monti/v1/ai/settings { expectedVersion, quick: { keyId, model } }`); without a choice it is the service's quick default of the first key that has one. Decision actions (System One) have no service among the keys and do not run.
- **Uses**: the plugin tells the key store which keys the quick tasks and a new conversation use, so deleting such a key lists them first.
- **Changing the secret**: see "Plugin secrets" and "API key store" in the core README.

## Admin agent

The design is `docs/design/agent.md`. `POST /api/monti/v1/ai/agent { runId?, messages, model?, context: { screen, collection?, entryId?, selectedIds? } }` runs the assistant and answers with the AI SDK UI message stream (`useChat` reads it; the message metadata carries `runId`, and at the end the `usage` of the whole conversation). Every operation of the core and the plugins (`cms.operations()`) is a tool named with `_` for `.` (`entries_list`), run as the signed-in admin. A `read` runs and sees the run's planned changes applied. A `write` never changes the site: it plans (`cms.writes.plan`), and its changes become items of the run's proposal, sent to the panel as `data-proposal` parts and stored with the conversation. A failed operation is a tool result `{ error: { code, message } }`, a result over 20,000 characters is cut with a note to narrow the query, and the same tool with the same input a third time in a row is not run. `editor_read` and `editor_selection` have no `execute` and are offered only when `context.entryId` is set: the browser answers them. A run is at most 12 model steps; a failed model request is retried once per step.

- **Model**: `model: { keyId, model, thinking }` in the request (the chat input's pick, stored with the conversation), else the built-in default (see Service keys). Without a usable key the request is refused (`service_unavailable`).
- **Tool calling**: a model never tried is tried; a "tools not supported" answer is stored per key and model (`toolSupport` in the settings view) and refused (`agent_unavailable`, 409), and the model menu leaves such a model out.
- **Credit**: a service that refuses for lack of credit ends the stream with `credit_exhausted`; the panel says so with the key's name and offers "Send with another model".
- **Conversations**: stored in the plugin storage (`agent-runs`) with their messages, status (`running`, `done`, `failed`, `stopped`) and usage. `GET /api/monti/v1/ai/agent/runs` lists the signed-in admin's own (the last opened or asked in first, `page`, `pageSize`), `GET /api/monti/v1/ai/agent/runs/{id}` returns one, only to that admin, and marks it opened, and `DELETE /api/monti/v1/ai/agent/runs/{id}` deletes it. A conversation stores up to 1,000,000 characters of messages, and an admin keeps their latest 100. A conversation nobody opened or asked in for the days the settings say (`PUT /api/monti/v1/ai/settings { expectedVersion, unopenedDays: 7 | 30 | 90 | null }`, 30 until chosen, `null` keeps them) is deleted when the list is read or a new conversation starts.
- **Proposals**: stored in the plugin storage (`agent-proposals`), one per run that wrote, quoting the request. `GET /api/monti/v1/ai/proposals/{id}` returns one and marks the waiting items whose target changed since as `stale`. `PATCH … { include: { <item id>: boolean } }` puts items in or leaves them out. `POST …/apply` applies the included waiting items one by one as the admin, recorded on each change as the agent's (`agent: { runId, proposalId }` in the activity log), and answers with one JSON line per step and the proposal at the end; an item that fails keeps its reason and the others go on. `POST …/revert` undoes the applied items, leaving alone one changed after it was applied. `POST …/discard` closes a waiting proposal without changing anything. Deleting a conversation deletes its proposals.
- **Admin**: a `data-proposal` part shows as a proposal card in the conversation (groups of changes, apply with progress, undo all, discard); "상세 보기" opens the review page `/admin/ai/review/<id>` (one line or side by side per group, a check per change). The past conversations say what came of each conversation (`outcome` on `GET /api/monti/v1/ai/agent/runs`). The media library's pick bar has "✦ 대체 텍스트", which asks the assistant about the picked files.
- **Writing rules**: one text the agent follows when it writes, kept in the database so a deployed site can change it: `GET /api/monti/v1/ai/writing-rules`, `PUT … { expectedVersion, text }` (at most 4,000 characters).
- `CMS_AI_FAKE=1` uses a scripted model that calls `site_describe` and answers with the collection names.

## Fake connection (development only)

With `CMS_AI_FAKE=1` (excluded from production builds), it returns canned answers without a key. The answer is built from the result
shape and the input kinds (input names are ignored). An MDX result echoes the MDX input as is (for streaming, paragraphs that start
with text get a `(fake)` marker), a text result uses the first text input, and candidates are built from choices, then code inputs,
then text inputs. An action whose result must have a specific shape to pass its code checks (for example a diagram) puts
`fake: (input) => answer` in its definition (for candidate results, one candidate per line). A real connection never calls `fake`.

## Features

- **Streaming**: with `stream: true` in the action definition (text or MDX results from the generate engine), the result appears
  gradually. In the UI, use `useAiAction("name").stream(input, { onText })`. In the API, pass `stream: true` to `/ai/run` (JSON with
  one event per line).
- **Prompt snippet**: text inserted into several actions' instructions as `{{snippet.key}}` (style guide, tone, audience, and so on),
  written in the config: `ai({ snippets: { styleGuide: { label: "Style guide", text: "…" } } })`. The config decides the key, the name
  and the content. An instruction (`prompt`) can only use these snippets (checked when the config is built).
- **Polish and draft**: `polish` (the menu that appears when you select text in the body; shows the changes, then applies them) and
  `draft` (slash menu and the ⋯ menu of an empty document; inserts at the cursor). If the prompt snippet `styleGuide` exists, it is used
  automatically; for a different key, pass the style guide with `aiPresets.polish({ styleGuide: "key" })`.
- **Multiple translation actions**: if several actions attach to `translation`, each gets a button (the action name) next to the block
  handle, and "Translate all" lets you pick the action to use.

## Block actions

With `attach: [{ slot: "block", block: "block name" }]`, a button appears next to that block's handle. The block's source (MDX, for
example ` ```mermaid … ``` `) is sent as the `block` input, and if the result (MDX) is a single block of the same kind, the changes
are shown and then that block is replaced. The block name must be a block the site uses (checked when the config is built). Block
extensions and site blocks attach the same way.

The block extension's Mermaid and chart actions (create: slash menu, edit: next to the block handle) are added by that block's plugin,
so you don't list them. For site blocks, attach them yourself.

```ts
ai({
	actions: {
		graphvizEdit: aiAction({
			label: "Edit graph",
			input: { block: aiInput.mdx({ label: "Graph", required: true }) },
			prompt: "Edit the ```graphviz code fence as requested. Reply with the edited fence only.",
			result: "mdx",
			stream: true,
			askInstruction: true,
			attach: [{ slot: "block", block: "graphviz" }],
		}),
	},
});
```

`askInstruction` lets the person type an extra request before the run; only the translation, selection, insert and block slots have a place for it (a field, image or media action runs at one press and puts its result in at once), and the config check refuses it elsewhere.

For a streamed MDX result, only a ` ```mdx ` fence wrapping the whole answer is stripped. Fences of other languages, which are the
block's source, are left as is.

## Entry points

| Entry point | Contents |
| --- | --- |
| `@monti-cms/ai` | `ai`, `aiAction`, `aiInput`, `aiPresets`, `resolveAiActions`, contribution types (`AiContribution`, `AiActionFactory`, `AiSiteView`) (for the site config, shared by server and browser) |
| `@monti-cms/ai/server` | Server side (API routes). Loaded by the core. It is an empty entry point in browser bundles |
| `@monti-cms/ai/admin` | Admin side (assistant panel, the Models section of the API keys page, provider), `useAiAction`, `AiButton`, `aiClient` |

## Development

```bash
pnpm --filter @monti-cms/ai test:run
```

The tests are only the API key storage checks (`KEY-A1`–`KEY-A3` in `src/__test__/settings.test.ts`). The rest were removed on 2026-11-01
because the package is being rewritten around the agent (#312), which brings its own tests.
