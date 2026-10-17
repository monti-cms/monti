# Enforce a slug rule before save

Goal: a post's address may only be lowercase ASCII (`hello-world`, `react-19`). A slug like `Hello-World` or `안녕` is refused with an error that says what to write, in the admin, in the API and in an import alike. A second hook fixes what can be fixed instead of refusing it.

The code below is the recipe's own files in [`src/slug-rule/`](src/slug-rule/), type checked in CI.

## What you need to know

1. **Every content write goes through one pipeline** (create, save, publish, bulk, import, the AI plugin). Your rule lives there once, so nothing can write around it ("Hook contract" in the [core README](../../packages/core/README.md)).
2. **Write hooks** are `transform`, `validate`, `validatePublish` and `afterCommit`, set as `hooks` in `defineConfig`, or in a plugin (the `hooks` of its server module).
3. **`validate` can only add failures.** Core has already prepared the data; your issues join the core ones, and any of them blocks the write with `validation_failed`.
4. **An issue** is `{ code, path, message }`. `path` is the field the editor shows the message under, and `message` is the text the person reads (a code that core does not know is shown as its `message`).
5. **`transform`** runs before core prepares the data. It returns the data to prepare (`metadata`, `doc`, and now `slug`), and what it returns still goes through core, so it cannot get a bad value past a core check.

## The code

Both are **checks before the save**: they run inside the request, in order, and can change or block the write. The rule: a `validate` check returns an issue for a slug that is not lowercase ASCII. A `transform` check lowercases the slug first, so only what lowercasing cannot fix is refused. Each stage takes a list, so the two combine by listing them.

<!-- src/slug-rule/hooks.ts -->
```ts
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

Wire them in `monti.config.ts`:

<!-- src/slug-rule/monti.config.ts -->
```ts
import { defineConfig, postgres } from "@monti-cms/core/server";
import schema from "../site/schema";
import { lowercaseSlugs, slugRule } from "./hooks";

export const cms = defineConfig({
	schema,
	database: postgres(),
	// Fix first, then refuse the rest. Different stages, so the lists do not overlap.
	hooks: { ...lowercaseSlugs, ...slugRule },
});
```

## As a plugin

The same hooks are how a package ships a rule: the `hooks` of the plugin's server module.

<!-- src/slug-rule/index.ts -->
```ts
import { definePlugin } from "@monti-cms/core";

export const slugRulePlugin = () => definePlugin({ name: "slug-rule", server: () => import("./server") });
```

<!-- src/slug-rule/server.ts -->
```ts
import { defineServerPlugin } from "@monti-cms/core/server";
import { lowercaseSlugs, slugRule } from "./hooks";

export default defineServerPlugin({ hooks: { ...lowercaseSlugs, ...slugRule } });
```

Then `plugins: [slugRulePlugin()]`. The server side is always a module of its own, loaded on the server only, even for two small hooks (see "Why a module of its own" in the [Slack recipe](slack-on-publish.md#why-a-module-of-its-own)).

## What it looks like

- The admin shows the `message` (with the field `path`) in the error of the refused save.
- The API answers `422` with `{ "error": { "code": "validation_failed", "issues": [{ "code": "slug_not_lowercase_ascii", "path": "slug", "message": "…" }] } }`.
- A thrown error carries the same text (`validation_failed: The slug "Hello-World" must use only lowercase a-z, … (slug)`), so a log line or a failed test says what is wrong, not only a code.

## Testing it

`testServer()` from `@monti-cms/core/testing` gives `defineConfig` a Postgres schema of its own (from `CMS_TEST_DATABASE_URL`) and a login that is always an admin; `cms.migrate()` creates the tables and `drop()` removes the schema. A test then calls the real service, so the real pipeline runs:

<!-- src/slug-rule/test-setup.ts -->
```ts
import { defineConfig } from "@monti-cms/core/server";
import { testServer } from "@monti-cms/core/testing";
import { afterAll, beforeAll } from "vitest";
import schema from "../site/schema";
import { slugRule } from "./hooks";

const test = testServer();
export const cms = defineConfig({ schema, hooks: slugRule, ...test.server });
beforeAll(() => cms.migrate());
afterAll(async () => {
	await cms.close();
	await test.drop();
});
```
