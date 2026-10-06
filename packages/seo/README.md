# @monti-cms/seo

English | [한국어](README.ko.md)

SEO extension for `@monti-cms/core`. It adds a field set for search engines and sharing, the search result and share previews in the edit screen, character counts for the search title and description,
and a switch to hide the page from search engines. With `@monti-cms/ai`, search title and description suggestions are attached too. Public pages read values with `seoOf`.

## Registration

```ts
// cms.config.ts
import { seo, seoFields } from "@monti-cms/seo";

const article = defineCollection({
	label: "Article",
	kind: "document",
	fields: {
		title: fields.text({ label: "Title" }),
		slug: fields.slug({ label: "Slug", from: "title" }),
		excerpt: fields.text({ label: "Excerpt", role: "summary" }),
		...seoFields(),
	},
	layout: [{ fields: ["title", "slug", "excerpt"] }], // SEO fields gather in the SEO tab even if not listed
	list: { columns: ["title", "status"] },
});

export default defineConfig({
	// …
	plugins: [seo()],
});
```

```css
@import "@monti-cms/seo/styles.css"; /* after the admin package styles (finds classes in the published bundle) */
```

## Field set `seoFields(options?)`

| Slot | Default name | Field | Role (`role`) | Edit screen |
| --- | --- | --- | --- | --- |
| `preview` | `seoPreview` | view field `search` | - | Search result and share preview. An empty title or description falls back to the title or summary role value |
| `title` | `seoTitle` | text | `seoTitle` | When empty, shows the title as a hint, and a character count (recommended 60) |
| `description` | `seoDescription` | multi-line text | `seoDescription` | When empty, shows the summary as a hint, and a character count (recommended 155) |
| `image` | `seoImage` | media (`fields.media`, image) | `ogImage` | Media picker. An image in use cannot be deleted |
| `noindex` | `seoNoindex` | select (`index`, `noindex`) | `noindex` | A switch in the label row. On means `noindex` |
| `canonical` | `seoCanonical` | text | `canonical` | Canonical URL |

Every field has a `tab` (default `SEO`), so they gather in that tab of the edit screen even without a `layout`. Values are found by role, not by field name,
so names are up to the site.

```ts
seoFields({
	keys: { title: "metaTitle", image: "ogImageId" }, // field names (reuse the names of values already stored)
	labels: { title: "Search title" }, // labels
	tab: "Search", // tab name
	localized: false, // keep title, description, image and canonical URL separate per language? (default true; hiding is always shared)
	limits: { title: 70, description: 160 }, // recommended lengths: the count changes color when exceeded and it becomes the AI suggestion length (saving is not blocked)
	omit: ["canonical"], // slots to omit
});
```

The recommended length is stored in the field's `inputOptions.limit`. If you need a limit that blocks saving, add a separate field that uses the field `max`.

## Plugin `seo(options?)`

- **Admin UI** (`@monti-cms/seo/admin`): registers the view field `search`, the input pieces `seo-title` and `seo-description` (hint and character count),
  and `seo-noindex` (switch) through `CmsAdminComponentsProvider`. Without the registration (if the extension is removed) the same fields appear as default inputs.
- **Config validation**: `seoTitle`, `seoDescription` and `canonical` must be text, `ogImage` must be media, and `noindex` must be a select
  field with a `noindex` option (`validateSeoFields`).
- **AI features**: with `@monti-cms/ai`, it adds `seoTitle` (search title suggestions, 3 candidates) and `seoDescription` (search description suggestions)
  (`contributes.ai`). They attach to every collection that has the role fields, and the length is field `max` → recommended length → 60 / 155. To change one:
  `aiPlugin({ actions: { seoTitle: seoAi.title({ prompt }) } })`; to turn it off: `seoTitle: false` or `seo({ ai: false })`.

## Public pages `seoOf(collection, metadata)`

```ts
import { seoOf } from "@monti-cms/seo";
import { post } from "@/cms.config";

const { title, description, imageId, canonical, noindex } = seoOf(post, entry.metadata);
```

It reads values by role from the collection definition (the result of `defineCollection`) and the stored metadata. An empty title or description is filled from the title (`title`) or summary
(`role: "summary"`), and empty values are `undefined`. The share image is a media ID, so the site builds the public URL
(`cms.read.mediaUrl(id)`, from the `cms` instance of the app's `cms.server.ts`).

## Entry points

| Entry point | Contents |
| --- | --- |
| `@monti-cms/seo` | `seo`, `seoFields`, `seoOf`, `seoAi`, `SEO_ROLES`, `validateSeoFields` (site config and public pages, shared by server and browser) |
| `@monti-cms/seo/admin` | Admin-side provider (the core loads it through the plugin definition's `admin`) |

## Development

```sh
pnpm --filter @monti-cms/seo test:run     # example blog config + other-site config
pnpm --filter @monti-cms/seo typecheck
```
