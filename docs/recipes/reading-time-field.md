# A custom admin field screen: reading time

Goal: the properties panel of a post shows "3 min read", computed from the body being typed. It is a field that stores nothing and draws one screen of your own.

The code below is the recipe's own files in [`src/reading-time/`](src/reading-time/), type checked in CI.

## What you need to know

1. **A view field** (`{ kind: "view", view: "reading-time" }`) stores no value. It draws, in its place in the properties panel, the screen registered under that name.
2. **Admin components are declared by a plugin's admin side**: `definePlugin({ admin: () => import("./admin") })`, whose default export is `defineAdminPlugin({ components: { fieldViews: { … } } })`. The admin applies the declaration; there is no provider to write ("Adding site components" in the [admin README](../../packages/admin/README.md)).
3. **The screen receives `{ collection, form, entry }`.** `form` is the entry as it is being edited, and its `form.doc` is the live body (a stored document), so the number follows the typing. `entry` is what the server last saved.
4. **`useSite()`** gives the site (`site.DEFAULT_LOCALE`, ...) and **`toPlainText(site, doc)`** gives the readable text of a document in any notation. Both come from `@monti-cms/admin`, like everything else this screen uses.

## The code

The admin module, a `"use client"` module with the screen and its declaration. `Intl.Segmenter` finds words in any language, so Korean and Japanese work too:

<!-- src/reading-time/admin.tsx -->
```tsx
"use client";

import { defineAdminPlugin, type FieldViewProps, toPlainText, useSite } from "@monti-cms/admin";

const WORDS_PER_MINUTE = 200;

function readingMinutes(text: string, locale: string): number {
	let words = 0;
	for (const part of new Intl.Segmenter(locale, { granularity: "word" }).segment(text)) if (part.isWordLike) words += 1;
	return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
}

function ReadingTimeView({ form, entry }: FieldViewProps) {
	const site = useSite();
	const minutes = readingMinutes(toPlainText(site, form.doc), entry?.locale ?? site.DEFAULT_LOCALE);
	return <p>{minutes} min read</p>;
}

export default defineAdminPlugin({
	components: { fieldViews: { "reading-time": ReadingTimeView } }, // by the `view` name of the field
});
```

The plugin:

<!-- src/reading-time/index.ts -->
```ts
import { definePlugin } from "@monti-cms/core";

export const readingTime = () => definePlugin({ name: "reading-time", admin: () => import("./admin") });
```

Then add the field to the collection (`"readingTime": { "kind": "view", "view": "reading-time", "label": "Reading time" }`, as in [`src/site/schema.ts`](src/site/schema.ts)) and the plugin to the config: `plugins: [readingTime()]`.

## Notes

- For the value on the server instead (a list column, a feed), compute it when you read, or in an `entry.beforeValidate` subscriber that stores it in a real field.
- The default entry editor and its fields are not a public component, so to test the screen render it yourself inside a `SiteProvider`, the way the admin does around it.
