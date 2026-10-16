# Enforce a slug rule before save

Goal: a post's address may only be lowercase ASCII (`hello-world`, `react-19`). A slug like `Hello-World` or `안녕` is refused with an error that says what to write, in the admin, in the API and in an import alike. A second hook fixes what can be fixed instead of refusing it.

The snippets below are a sketch to adapt, not tested code.

## What you need to know

1. **Every content write goes through one pipeline** (create, save, publish, bulk, import, the AI plugin). Your rule lives there once, so nothing can write around it ("Hook contract" in the [core README](../../packages/core/README.md)).
2. **Write hooks** are `transform`, `validate`, `validatePublish` and `afterCommit`, set as `hooks` in `defineConfig`, or in a plugin (the `hooks` of its `server`, inline or in its lazy module).
3. **`validate` can only add failures.** Core has already prepared the data; your issues join the core ones, and any of them blocks the write with `validation_failed`.
4. **An issue** is `{ code, path, message }`. `path` is the field the editor shows the message under, and `message` is the text the person reads (a code that core does not know is shown as its `message`).
5. **`transform`** runs before core prepares the data. It returns the data to prepare (`metadata`, `doc`, and now `slug`), and what it returns still goes through core, so it cannot get a bad value past a core check.

## A sketch

Both are **checks before the save**: they run inside the request, in order, and can change or block the write. The rule: a `validate` check returns an issue for a slug that is not lowercase ASCII. A `transform` check lowercases the slug first, so only what lowercasing cannot fix is refused. Each stage takes a list, so the two combine by listing them.

```ts
import { definePlugin } from "@monti-cms/core";
import type { WriteHooks } from "@monti-cms/core/server";

const LOWERCASE_ASCII_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const slugRule: WriteHooks = {
	validate: [
		({ collection, slug }) => {
			if (collection !== "post" || slug === null || LOWERCASE_ASCII_SLUG.test(slug)) return;
			return {
				issues: [
					{
						code: "slug_not_lowercase_ascii",
						path: "slug", // the field the editor shows the message under
						message: `The slug "${slug}" must use only lowercase a-z, digits and single hyphens (for example "hello-world").`,
					},
				],
			};
		},
	],
};

// Fix instead of refusing: `transform` runs first and returns the data to prepare (leave `slug` out to keep it).
export const lowercaseSlugs: WriteHooks = {
	transform: [
		({ collection, slug, metadata, doc }) =>
			collection === "post" && slug !== null ? { metadata, doc, slug: slug.toLowerCase() } : undefined,
	],
};
```

Wire it in `monti.config.ts`, one line:

```ts
export const cms = defineConfig({
	// …
	hooks: slugRule, // or { ...lowercaseSlugs, ...slugRule } to fix first and refuse the rest (different stages, so the lists do not overlap)
});
```

## As a plugin

The same object works as the `hooks` of a plugin's `server`, which is how a package ships a rule. These hooks are small and pure, so the plugin writes its `server` inline, with no module file:

```ts
export const slugRulePlugin = () => definePlugin({ name: "slug-rule", server: { hooks: { ...lowercaseSlugs, ...slugRule } } });
// plugins: [slugRulePlugin()]
```

Use an inline `server` when the hooks are light: it loads with every server start, the CLI and cold starts included (`monti.config.ts` is server-only, so secrets through `plugin.secrets` or the environment are fine). When they are heavy, or the plugin has routes, migrations or commands, make `server` a loader (`server: () => import("./server")`); the [Slack recipe](slack-on-publish.md#inline-or-server) does that for its network client.

## What it looks like

- The admin shows the `message` (with the field `path`) in the error of the refused save.
- The API answers `422` with `{ "error": { "code": "validation_failed", "issues": [{ "code": "slug_not_lowercase_ascii", "path": "slug", "message": "…" }] } }`.
- A thrown error carries the same text (`validation_failed: The slug "Hello-World" must use only lowercase a-z, … (slug)`), so a log line or a failed test says what is wrong, not only a code.

## Testing it

`testServer()` from `@monti-cms/core/testing` gives `defineConfig` a Postgres schema of its own (from `CMS_TEST_DATABASE_URL`) and a login that is always an admin; `cms.migrate()` creates the tables and `drop()` removes the schema. A test then calls the real service, so the real pipeline runs:

```ts
const test = testServer();
const cms = defineConfig({ schema, hooks: slugRule, ...test.server });
beforeAll(() => cms.migrate());
afterAll(async () => {
	await cms.close();
	await test.drop();
});
```
