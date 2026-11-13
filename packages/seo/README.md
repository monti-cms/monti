# @monti-cms/seo

English | [한국어](README.ko.md)

Monti's SEO plugin: search and share fields in a tab of their own, their preview in the editor, and `seoOf` for the site's pages.

```ts
// monti.config.ts
import { defineConfig } from "@monti-cms/core";
import { seo } from "@monti-cms/seo";

export default defineConfig({
	// …
	plugins: [seo()],
});
```

```tsx
// app/admin/page.tsx
import { AdminPage } from "@monti-cms/next/admin";
import { seoAdmin } from "@monti-cms/seo/admin";

export default function Page() {
	return <AdminPage plugins={[seoAdmin]} />;
}
```

The first is the plugin's server half; the second is its half in the browser (the inputs and the preview). Without the second the fields
are still there, drawn with their kinds' own inputs, and the preview is not.

## What it adds

A tab "SEO" in the property panel of every document collection. The tab is the plugin's: the settings show it locked, and its fields are
not written to `monti.schema.ts`. Taking the plugin out takes the tab out; the values stay in the entries.

| Field | Name | What it is |
|---|---|---|
| Preview | `seoPreview` | How the entry looks as a search result and as a shared link. It holds no value |
| SEO title | `seoTitle` | Text, per language. Empty, the site uses the entry's title, and the field says so with its length ("Same as Title · 10/60") |
| SEO description | `seoDescription` | Text, per language. Empty, the site uses the `summary` field |
| Share image | `seoImage` | A picture. Empty, the site uses the `cover` field |
| Hide from search | `seoNoindex` | A switch: `noindex`, or nothing |
| Canonical address | `seoCanonical` | The address of the page this one repeats |

- The count beside a written title or description turns to a warning past the recommended length (60 and 160). Nothing is refused.
- The lists can show the SEO title, the SEO description and the share image as columns ("add column"), each filtered by "empty".
- A field of one of these names in the site's own schema stands in the plugin's place.

## Options

```ts
seo({
	collections: ["post"], // the document collections that get the tab; all of them when left out
	language: "en", // the language of the fields' names; Korean when left out, as the admin is
	limits: { title: 70, description: 155 }, // the recommended lengths the counts warn past
	follows: { description: "lead", image: "hero" }, // the site's own fields an empty value falls back to
});
```

## On the site's pages

```ts
import { seoOf } from "@monti-cms/seo";

export async function generateMetadata({ params }) {
	const found = await reader.entry({ collection: "post", slug: (await params).slug, locale: "en" });
	if (!found || !("entry" in found)) return {};
	const seo = seoOf(found.entry);
	return {
		title: seo.title,
		description: seo.description,
		alternates: seo.canonical ? { canonical: seo.canonical } : undefined,
		robots: seo.noindex ? { index: false } : undefined,
		openGraph: seo.image ? { images: [{ url: seo.image.src, width: seo.image.width, height: seo.image.height }] } : undefined,
	};
}
```

`seoOf(entry, follows?)` gives the title (the entry's own when none was written), and the description, the share image, the canonical
address when there is one, and `noindex`. Give it the same `follows` as the plugin when the plugin was given any.

## Development

```sh
pnpm --filter @monti-cms/seo test
pnpm --filter @monti-cms/seo typecheck
```
