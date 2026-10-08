# A custom admin field screen: reading time

Goal: the properties panel of a post shows "3 min read", computed from the body being typed. It is a field that stores nothing and draws one screen of your own.

The snippets below are a sketch to adapt, not tested code.

## What you need to know

1. **A view field** (`{ kind: "view", view: "reading-time" }`) stores no value. It draws, in its place in the properties panel, the screen registered under that name.
2. **Admin components are registered by a plugin's admin side**: `definePlugin({ admin: () => import("./admin") })`, whose default export is `defineAdminPlugin({ Provider })`. The `Provider` is a `"use client"` component that wraps the admin and calls `CmsAdminComponentsProvider` with `fieldViews` ("Adding site components" in the [admin README](../../packages/admin/README.md)).
3. **The screen receives `{ collection, form, entry }`.** `form` is the entry as it is being edited, and its `form.doc` is the live body (a stored document), so the number follows the typing. `entry` is what the server last saved.
4. **`useSite()`** gives the site (`site.DEFAULT_LOCALE`, ...) and **`toPlainText(site, doc)`** (`@monti-cms/core/client`) gives the readable text of a document in any notation.

## A sketch

The screen and its provider. `Intl.Segmenter` finds words in any language, so Korean and Japanese work too:

```tsx
"use client";

import { type CmsAdminComponents, CmsAdminComponentsProvider, type FieldViewProps } from "@monti-cms/admin";
import { toPlainText, useSite } from "@monti-cms/core/client";
import type { ReactNode } from "react";

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

const components: CmsAdminComponents = { fieldViews: { "reading-time": ReadingTimeView } }; // by the `view` name of the field

export function ReadingTimeProvider({ children }: { children: ReactNode }) {
	return <CmsAdminComponentsProvider components={components}>{children}</CmsAdminComponentsProvider>;
}
```

The admin module (default export `defineAdminPlugin({ Provider: ReadingTimeProvider })`) and the plugin:

```ts
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
- The default entry editor and its fields are not a public component, so to test the screen render it yourself inside a `SiteProvider`, the way the admin does around it.
