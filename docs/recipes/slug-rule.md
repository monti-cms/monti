# Enforce a slug rule before save

Goal: a post's address may only be lowercase ASCII (`hello-world`, `react-19`). A slug like `Hello-World` or `안녕` is refused with an error that says what to write, in the admin, in the API and in an import alike. A second hook fixes what can be fixed instead of refusing it.

Code: [`examples/recipes/src/slug-rule`](../../examples/recipes/src/slug-rule). Test: `slug-rule.test.ts` in the same folder.

## What you need to know

1. **Every content write goes through one pipeline** (create, save, publish, bulk, import, the AI plugin). Your rule lives there once, so nothing can write around it ("Hook contract" in the [core README](../../packages/core/README.md)).
2. **Write hooks** are `transform`, `validate`, `validatePublish` and `afterCommit`, set as `hooks` in `defineConfig` (or in a plugin's server side).
3. **`validate` can only add failures.** Core has already prepared the data; your issues join the core ones, and any of them blocks the write with `validation_failed`.
4. **An issue** is `{ code, path, message }`. `path` is the field the editor shows the message under, and `message` is the text the person reads (a code that core does not know is shown as its `message`).
5. **`transform`** runs before core prepares the data. It returns the data to prepare (`metadata`, `doc`, and now `slug`), and what it returns still goes through core, so it cannot get a bad value past a core check.

## The code

The rule: `validate` returns an issue for a slug that is not lowercase ASCII. The second hook, `transform`, lowercases the slug first, so only what lowercasing cannot fix is refused.

<!-- source: examples/recipes/src/slug-rule/slug-rule.ts -->
```ts
import type { WriteHooks } from "@monti-cms/core/server";

/** Lowercase ASCII letters and digits, with single hyphens between them: `hello-world`, `react-19`. */
const LOWERCASE_ASCII_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Write hook: a slug must be lowercase ASCII. Put it in `hooks` of `defineConfig` (or in the `hooks` of a plugin's server side).
 * `validate` runs on every create, save and publish, after core has prepared the data, and can only add failures, so the rule cannot be
 * bypassed by a format import, the AI plugin or a bulk change: they all go through the same pipeline.
 */
export const slugRule: WriteHooks = {
	validate: ({ collection, slug }) => {
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
};

/**
 * The other choice: fix the slug instead of refusing it. `transform` runs first, before core prepares the data, and returns the data to prepare
 * (leave `slug` out to keep it). Use both hooks together to fix what can be fixed and refuse the rest.
 */
export const lowercaseSlugs: WriteHooks = {
	transform: ({ collection, slug, metadata, doc }) =>
		collection === "post" && slug !== null ? { metadata, doc, slug: slug.toLowerCase() } : undefined,
};
```

Wire it in `monti.config.ts`, one line:

```ts
export const cms = defineConfig({
	// …
	hooks: slugRule, // or { ...lowercaseSlugs, ...slugRule } to fix first and refuse the rest
});
```

The same object works as the `hooks` of a plugin's server side, which is how a package ships a rule.

## What it looks like

- The admin shows the `message` (with the field `path`) in the error of the refused save.
- The API answers `422` with `{ "code": "validation_failed", "issues": [{ "code": "slug_not_lowercase_ascii", "path": "slug", "message": "…" }] }`.
- A thrown error carries the same text (`validation_failed: The slug "Hello-World" must use only lowercase a-z, … (slug)`), so a log line or a failed test says what is wrong, not only a code.

## Testing it

`testServer()` from `@monti-cms/core/testing` gives `defineConfig` a Postgres schema of its own (from `CMS_TEST_DATABASE_URL`) and a login that is always an admin; `cms.migrate()` creates the tables and `drop()` removes the schema. The test then calls the real service, so the real pipeline runs:

```ts
const test = testServer();
const cms = defineConfig({ schema, hooks: slugRule, ...test.server });
beforeAll(() => cms.migrate());
afterAll(async () => {
	await cms.close();
	await test.drop();
});
```

## Found while writing it

- The hook context had no `slug`, so a rule about the address had to read `snapshot.slug`. Fixed: every hook gets `slug`, and a `transform` may return a new one.
- A refused write threw `validation_failed` and nothing else. Fixed: the error's message now lists what its issues say.
- There was no documented way to test a hook against the real pipeline. Fixed: `testServer()`.
