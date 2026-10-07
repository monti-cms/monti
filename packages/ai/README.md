# @monti-cms/ai

English | [한국어](README.ko.md)

The AI plugin for `@monti-cms/core`. It adds named AI actions (generate and decide), AI buttons next to fields, AI translation in the
translation editor, the admin AI screen (`<admin path>/ai`, `/admin/ai` by default), the AI API (`/api/cms/v1/ai/*`), and the AI data in the plugin storage
(`cms.storage("ai")`: collections `action-overrides`, `custom-actions` and `settings`). If you don't register the plugin, none of these exist.

The plugin peers on `@monti-cms/mdx`: installing the AI plugin means installing the MDX package too, and listing `mdx()` in `plugins` next to `aiPlugin()`, because its model reads and writes MDX through the `mdx` format ("The model reads and writes MDX").

## Registration

Add `aiPlugin()` to `plugins` in the site config. Built-in actions turn on by themselves when there is somewhere to attach them, and
actions added by other plugins (block extensions, SEO extension, and so on) attach by themselves too. List an action by name (key) in
`actions` only to change or turn it off.

```ts
import { aiAction, aiPlugin, aiPresets } from "@monti-cms/ai";

plugins: [
	aiPlugin({
		siteDescription: "A personal tech blog", // Goes at the very top of every action's instruction. Defaults to "website"
		actions: {
			summary: aiPresets.summary({ maxLength: 120 }), // Replace (same name)
			draft: false, // Turn off
			outline: aiAction({ … }), // Add (new name)
		},
	}),
],
```

### Built-in actions

| Name | Attaches to | Turns on when |
| --- | --- | --- |
| `slug` | Slug field (`fields.slug`) | A collection with a body has a slug field |
| `summary` | Text field with the summary role (`role: "summary"`). Length comes from the field's `max` (160 if unset) | It is in a collection with a body |
| `tags` | Multi-relation field pointing to an item collection (`kind: "item"`). Choices come from the target collection | It is in a collection with a body |
| `category` | Single-relation field pointing to an item collection (`kind: "item"`). Choices come from the target collection | It is in a collection with a body |
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
- If the shared text `styleGuide` (`aiPlugin({ shared: { styleGuide: … } })`) exists, it goes into the polish and draft instructions.
  If not, nothing is added.
- On the admin AI screen, actions are ordered: field actions first, then built-in actions, then other plugins' actions, then actions
  added in the config.
- `aiPresets.name(options)` returns a function that builds an action from the site config (`AiActionFactory`). It stays off if there is
  nowhere to attach it.

### Actions added by other plugins

A plugin adds actions with `definePlugin({ contributes: { ai: { actions: { name: definition or factory } } } })` (`AiContribution`).
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
- The admin AI screen only edits enabled, request intake, connection, model, inputs to send, instruction, threshold, and check values.
  Only the edited values are kept in the DB (the `action-overrides` collection of the plugin storage). "Reset to default" only resets the input fields; saving is a
  separate click.
- Running: `POST /api/cms/v1/ai/run { action, input | inputs, env }`. In the admin UI, call by name, as in
  `useAiAction("summary").run({ title, body })` or
  `<AiButton action="summary" input={() => ({ title, body })} onResult={…} />` (`@monti-cms/ai/admin`). The name, input, and result
  types come from the config.
- The decide engine (`engine: "decide"`, System One) gets a probability for each choice (`choices`) and returns only those at or above
  the threshold as candidates.

### The model reads and writes MDX

The model reads and writes a text format, and MDX is that format. The admin holds the body as a stored document, so the AI buttons work through the `mdx` format registered in the admin
(`useFormat("mdx")`, `@monti-cms/admin`): the body sent to the model, the selected text and the block to fix are written with the format's `export`, and the MDX the model answers with is read with its
`import` (a text that does not read is kept whole in a box instead of being half converted). The format comes from `mdx()` of `@monti-cms/mdx`, which registers it in the admin. Without it, the actions that work on the body are not offered.

## Result checks

- **Built-in checks**: only those usable by any action. Format (`pattern`), length (`maxLength`), existing values only (`exists`, a
  value among the action's choices), and within choices (`oneOf`, one of a fixed list). On the admin AI screen you turn them on or off,
  edit their values, and add or delete format, length, and within-choices checks on any action (checks set by the definition can only
  be turned off).
- **Code checks (`defineValidator`)**: checks specific to one action are written as functions and put into the action definition's
  `checks`. The admin screen shows the `label` and only lets you turn them on or off. They run on the server after the built-in checks,
  in the listed order, once per value (one candidate, or the whole text or MDX result). `undefined` or `true` passes; `false` or a
  string rejects (for text and MDX this fails the result, and a string is the reason); `{ detail }` passes and attaches a note next to
  the candidate. The second argument (`AiValidatorContext`) provides the input, collection, locale (default locale if none), the entry
  being edited, the choices, and the core content lookup `content`.
- **Core content lookup (`context.content`)**: the run API fills it with the core public API (`createContentLookup` from
  `@monti-cms/core/plugin/server`). Plugins don't read core tables directly. For now it has
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

## Stored service keys

The service keys entered on the AI screen are kept encrypted in the `settings` collection of the plugin storage. The plugin never sees the server config's `secret`: the CMS instance derives
a key for the plugin from it and the plugin name (`cms.secrets("ai")`, HKDF-SHA256, `monti:plugin:ai:v1`), so the key cannot be used for another plugin's data
and other plugins cannot read these keys. See "Plugin secrets" in the core README. Stored values look like `mk1:<key id>:<iv>:<tag>:<body>`.

- **Upgrade from before per-plugin keys**: keys stored by earlier versions (`v1:<iv>:<tag>:<body>`, encrypted under `sha256("cms-ai-key:" + secret)`) keep
  working with no step from you, and `CMS_SECRET` stays as it is. The plugin reads them with the old derivation and re-encrypts them in the new format in two
  places: on the next save of any AI connection (all stored keys are re-encrypted together), and on `monti migrate` (a one-time upgrade of whatever is left;
  running it again changes nothing). Nothing needs to be entered again.
- **Changing `secret`**: put the new value in `secret` and keep the old one in `previousSecrets` in the server config. Stored keys (new or old format) still
  decrypt with the old secret, and `monti migrate` or the next save re-encrypts them with the new one. Drop the old value from `previousSecrets` after that.
  Without `previousSecrets`, keys made under the old secret can no longer be read and have to be entered again.

## Data moved to the plugin storage

The plugin used to create its own tables (`ai_action_overrides`, `ai_custom_actions`, `ai_settings`) in the site's database. It now keeps the same data in the plugin storage
(`cms.storage("ai")`, collections `action-overrides`, `custom-actions` and `settings`). `monti migrate` copies the rows once, with their values, versions and dates, so an editor who
had a screen open before the upgrade still saves against the right version, and the custom actions keep their order. The old tables are only read and stay in the database as a backup:
drop them once you have checked the site. The oldest table (`ai_features`) is read in the same way where its edited values had not been moved yet.
Replace every instance of the old version at the same time as you run `monti migrate`; an old instance keeps writing the old tables, and those writes are not copied again.

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
- **Shared text**: text inserted into several actions' instructions as `{{shared.key}}` (style guide, tone, audience, and so on).
  There are two kinds.
  - Config text: `aiPlugin({ shared: { styleGuide: { label: "Style guide", text: "…" } } })`. The config decides the key and name,
    and only the content is edited in the "Shared text" tab of the admin AI screen ("Reset to default" resets the input field to the
    config text). It can't be deleted. An instruction (`prompt`) in the config can only use config text (checked when the config is
    built).
  - Added text: in the "Shared text" tab, "Add text" lets you add a key (starts with a letter; letters, digits, and `_`), a name, and
    the content. The key can't be changed after creation and must not clash with config text or other text. It can be used by
    instructions edited in the admin screen and by UI actions. It can't be deleted while an action's instruction uses it (the action
    name is shown).

  Both are stored in the `shared` item of the `settings` collection as `{ texts: { key: edited content }, added: [{ key, label, text }] }`
  (the old shape is still read). The API is `/ai/shared`: `GET` (list, `source: "config" | "added"`),
  `POST { expectedVersion, key, label, text }` (add), `PATCH { expectedVersion, key, label?, text }` (edit one),
  `PUT { expectedVersion, texts }` (edit many), and `DELETE ?key=&expectedVersion=` (delete). All return the updated list, and a
  version mismatch returns 409.
- **Polish and draft**: `polish` (the menu that appears when you select text in the body; shows the changes, then applies them) and
  `draft` (slash menu and empty-document toolbar; inserts at the cursor). If the shared text `styleGuide` exists, it is used
  automatically; for a different key, pass the style guide with `aiPresets.polish({ styleGuide: "key" })`. Shared text added in the
  admin screen goes into the instruction as `{{shared.key}}` in the admin screen.
- **Try it**: on the admin AI screen, run an action before saving from the bottom right of the action. The fields are built from the
  action's input kinds (text, MDX, and code get multi-line fields, current value gets a single-line field, an image takes a media ID
  or site path, and locale uses the site config's locale picker). Only the inputs to send, required inputs, and locale inputs are
  shown, and it doesn't run if a required field is empty.
- **Multiple translation actions**: if several actions attach to `translation`, each gets a button (the action name) next to the block
  handle, and "Translate all" lets you pick the action to use.
- **UI actions**: "Add action" on the admin AI screen creates an action without code. In the right-hand panel you edit the name, where
  it attaches (next to a field, selection menu, insert menu, body block, body image, media), result shape, engine and connection,
  instruction, what to send, and checks together, try it before saving, then save everything at once. For relation and select fields
  (tags, category, and so on), you can also pick the decide engine (System One). It is stored in the DB (the `custom-actions` collection). The
  initial thresholds for relation and select field actions are `CUSTOM_PICK_DEFAULTS` (multiple: 0.6, 5 items; single: 0.3, 2 items).

## Block actions

With `attach: [{ slot: "block", block: "block name" }]`, a button appears next to that block's handle. The block's source (MDX, for
example ` ```mermaid … ``` `) is sent as the `block` input, and if the result (MDX) is a single block of the same kind, the changes
are shown and then that block is replaced. The block name must be a block the site uses (checked when the config is built). Block
extensions and site blocks attach the same way.

The block extension's Mermaid and chart actions (create: slash menu, edit: next to the block handle) are added by that block's plugin,
so you don't list them. For site blocks, attach them yourself.

```ts
aiPlugin({
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

For a streamed MDX result, only a ` ```mdx ` fence wrapping the whole answer is stripped. Fences of other languages, which are the
block's source, are left as is.

## Entry points

| Entry point | Contents |
| --- | --- |
| `@monti-cms/ai` | `aiPlugin`, `aiAction`, `aiInput`, `aiPresets`, `resolveAiActions`, contribution types (`AiContribution`, `AiActionFactory`, `AiSiteView`) (for the site config, shared by server and browser) |
| `@monti-cms/ai/server` | Server side (API routes, data migration). Loaded by the core. It is an empty entry point in browser bundles |
| `@monti-cms/ai/admin` | Admin side (AI screen, provider), `useAiAction`, `AiButton` |
| `@monti-cms/ai/styles.css` | The admin layout: the styles of the AI screen and buttons, prebuilt and scoped to the admin (no Tailwind needed in the app). Import it after `@monti-cms/admin/styles.css` |

## Development

```bash
pnpm --filter @monti-cms/ai test:run        # Example blog config + another site config
pnpm --filter @monti-cms/ai test:other-site # Another site config only (`test/other-site.config.ts`)
```

The other site config attaches the AI field actions to that site's own field names (`excerpt`, `topicIds`, `authorId`, `metaTitle`, …).
The config-independent check is `src/__test__/any-site.test.ts` (whether field actions attach to fields of the right kind and run with
slot inputs).
