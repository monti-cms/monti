# A custom admin field screen: reading time

Goal: the properties panel of a post shows "3 min read", computed from the body being typed. It is a field that stores nothing and draws one screen of your own.

Code: [`examples/recipes/src/reading-time`](../../examples/recipes/src/reading-time). Test: `reading-time.test.tsx`.

## What you need to know

1. **A view field** (`{ kind: "view", view: "reading-time" }`) stores no value. It draws, in its place in the properties panel, the screen registered under that name.
2. **Admin components are registered by a plugin's admin side**: `definePlugin({ admin: () => import("./admin") })`, whose default export is `defineAdminPlugin({ Provider })`. The `Provider` is a `"use client"` component that wraps the admin and calls `CmsAdminComponentsProvider` with `fieldViews` ("Adding site components" in the [admin README](../../packages/admin/README.md)).
3. **The screen receives `{ collection, form, entry }`.** `form` is the entry as it is being edited, and its `form.doc` is the live body (a stored document), so the number follows the typing. `entry` is what the server last saved.
4. **`useSite()`** gives the site (`site.DEFAULT_LOCALE`, ...) and **`toPlainText(site, doc)`** (`@monti-cms/core/client`) gives the readable text of a document in any notation.

## The code

The computation, a pure function you can test on its own (`Intl.Segmenter` finds words in any language, so Korean and Japanese work):

<!-- source: examples/recipes/src/reading-time/reading-time.ts -->
```ts
/** Reading speed used for the estimate: words per minute. */
export const WORDS_PER_MINUTE = 200;

/**
 * Whole minutes to read a text, never less than one. `Intl.Segmenter` finds the words of any language (Korean and Japanese have no spaces to count),
 * so the same function serves every locale of the site.
 */
export function readingMinutes(text: string, locale = "en"): number {
	let words = 0;
	for (const part of new Intl.Segmenter(locale, { granularity: "word" }).segment(text)) if (part.isWordLike) words += 1;
	return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
}
```

The screen:

<!-- source: examples/recipes/src/reading-time/view.tsx -->
```tsx
"use client";

import type { FieldViewProps } from "@monti-cms/admin";
import { toPlainText, useSite } from "@monti-cms/core/client";
import { readingMinutes } from "./reading-time";

/**
 * The screen of the view field `{ kind: "view", view: "reading-time" }`. It stores nothing: `form` is the entry as it is being edited (the body
 * is `form.doc`), so the number follows the typing, not only the last save.
 */
export function ReadingTimeView({ form, entry }: FieldViewProps) {
	const site = useSite();
	const locale = entry?.locale ?? site.DEFAULT_LOCALE;
	const minutes = readingMinutes(toPlainText(site, form.doc), locale);
	return <p data-reading-time={minutes}>{minutes} min read</p>;
}
```

Registering it (provider, admin side, and the plugin with the field):

<!-- source: examples/recipes/src/reading-time/provider.tsx -->
```tsx
"use client";

import { type CmsAdminComponents, CmsAdminComponentsProvider } from "@monti-cms/admin";
import type { ReactNode } from "react";
import { ReadingTimeView } from "./view";

const components: CmsAdminComponents = { fieldViews: { "reading-time": ReadingTimeView } }; // by the `view` name of the field

export function ReadingTimeProvider({ children }: { children: ReactNode }) {
	return <CmsAdminComponentsProvider components={components}>{children}</CmsAdminComponentsProvider>;
}
```

<!-- source: examples/recipes/src/reading-time/admin.ts -->
```ts
import { defineAdminPlugin } from "@monti-cms/admin/plugins";
import { ReadingTimeProvider } from "./provider";

export default defineAdminPlugin({ Provider: ReadingTimeProvider });
```

<!-- source: examples/recipes/src/reading-time/index.ts -->
```ts
import { definePlugin } from "@monti-cms/core";

/** The field to add to a collection: `fields: { …, readingTime: readingTimeField }`. It stores no value. */
export const readingTimeField = { kind: "view", view: "reading-time", label: "Reading time" } as const;

/** `plugins: [readingTime()]` registers the screen of the field above in the admin. */
export const readingTime = () => definePlugin({ name: "reading-time", options: {}, admin: () => import("./admin") });
```

Then add the field to the collection and the plugin to the config:

```json
"readingTime": { "kind": "view", "view": "reading-time", "label": "Reading time" }
```

```ts
plugins: [readingTime()],
```

## Notes

- For the value on the server instead (a list column, a feed), compute it when you read, or in a `transform` hook that stores it in a real field.
- The default entry editor and its fields are not a public component, so the test renders the screen itself with a `SiteProvider`, the way the admin does around it.

## Found while writing it

- That the live body is `form.doc`, and that `toPlainText` exists, was found in the admin and core sources. Both are now in the READMEs.
- A plain-object collection in `defineSite({ collections })` must say `body` itself, while `defineCollection(...)` and a schema file fill it in. The recipe passes the schema to `defineSite({ schema })`, which applies the defaults.
