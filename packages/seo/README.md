# @monti-cms/seo

English | [한국어](README.ko.md)

SEO extension for `@monti-cms/core`. It adds a field set for search engines and sharing, the search result and share previews in the edit screen, character counts for the search title and description,
and a switch to hide the page from search engines. With `@monti-cms/ai`, search title and description suggestions are attached too. Public pages read values with `seoOf`.

## Registration

Add the plugin to the config. The fields themselves are ordinary fields of `monti.schema.ts`, found by role, so the schema file stays plain data that the settings screen can edit.

```ts
// monti.config.ts
import { seo } from "@monti-cms/seo";

export const cms = defineConfig({
	schema,
	// …
	plugins: [seo()],
});
```

In the settings screen, open the collection's **Fields** tab and choose **Add SEO fields**. The action is shown when the `seo()` plugin is on and the collection has no field with an SEO role yet; it writes the fields below into `monti.schema.ts` through the usual draft and review steps (names already taken get a number). The same fields can be written by hand:

```ts
// monti.schema.ts
fields: {
	title: { kind: "text", label: "Title" },
	summary: { kind: "text", label: "Summary", role: "summary" },
	searchPreview: { kind: "view", view: "search" },
	seoTitle: { kind: "text", label: "Search title", localized: true, role: "seoTitle", input: "seo-title", inputOptions: { limit: 60 } },
	seoDescription: { kind: "text", label: "Search description", localized: true, multiline: true, role: "seoDescription", input: "seo-description", inputOptions: { limit: 155 } },
	ogImageId: { kind: "media", label: "Share image", localized: true, role: "ogImage", accept: "image" },
	seoRobots: { kind: "select", label: "Hide from search engines", role: "noindex", input: "seo-noindex", options: { index: "Show", noindex: "Hide" }, defaultValue: "index" },
	canonicalUrl: { kind: "text", label: "Original URL", localized: true, role: "canonical", placeholder: "https://" },
},
```

The plugin places them in a tab of their own even when `layout` does not list them. The SEO panel needs no stylesheet of its own: `@monti-cms/admin/styles.css` already covers it (no Tailwind needed in the app).

## Field set `seoFields(options?)` (collections written in code)

A collection defined in code (`defineCollection` in `monti.config.ts`) can spread the same fields with `seoFields()`. Calling a function there means the schema is no longer a plain literal, so the settings screen shows it read-only; prefer the schema file unless the collection has to stay in code.

```ts
const article = defineCollection({
	label: "Article",
	kind: "document",
	fields: { title, slug, ...seoFields() },
});
```

| Slot | Default name | Field | Role (`role`) | Edit screen |
| --- | --- | --- | --- | --- |
| `preview` | `seoPreview` | view field `search` | - | Search result and share preview. An empty title or description falls back to the title or summary role value |
| `title` | `seoTitle` | text | `seoTitle` | When empty, shows the title as a hint, and a character count (recommended 60) |
| `description` | `seoDescription` | multi-line text | `seoDescription` | When empty, shows the summary as a hint, and a character count (recommended 155) |
| `image` | `seoImage` | media (`fields.media`, image) | `ogImage` | Media picker. An image in use cannot be deleted |
| `noindex` | `seoNoindex` | select (`index`, `noindex`) | `noindex` | A switch in the label row. On means `noindex` |
| `canonical` | `seoCanonical` | text | `canonical` | Canonical URL |

The `seo()` plugin places them in a tab of the edit screen of their own (default `SEO`, set with `seo({ tab })`), found by role and by the preview's view name, even without a `layout`. Values are found by role, not by field name,
so names are up to the site.

```ts
seoFields({
	keys: { title: "metaTitle", image: "ogImageId" }, // field names (reuse the names of values already stored)
	labels: { title: "Search title" }, // labels
	localized: false, // keep title, description, image and canonical URL separate per language? (default true; hiding is always shared)
	limits: { title: 70, description: 160 }, // recommended lengths: the count changes color when exceeded and it becomes the AI suggestion length (saving is not blocked)
	omit: ["canonical"], // slots to omit
});
```

The recommended length is stored in the field's `inputOptions.limit`. If you need a limit that blocks saving, add a separate field that uses the field `max`.

## Plugin `seo(options?)`

- **Admin UI** (`@monti-cms/seo/admin`): registers the view field `search`, the input pieces `seo-title` and `seo-description` (hint and character count),
  and `seo-noindex` (switch), declared in the `components` of its admin side. Without the registration (if the extension is removed) the same fields appear as default inputs.
- **Config validation**: `seoTitle`, `seoDescription` and `canonical` must be text, `ogImage` must be media, and `noindex` must be a select
  field with a `noindex` option (`checkSeoFields`).
- **AI features**: with `@monti-cms/ai`, it adds `seoTitle` (search title suggestions, 3 candidates) and `seoDescription` (search description suggestions)
  (`contributes.ai`). They attach to every collection that has the role fields, and the length is field `max` → recommended length → 60 / 155. To change one:
  `ai({ actions: { seoTitle: seoAi.title({ prompt }) } })`; to turn it off: `seoTitle: false` or `seo({ ai: false })`.

## Public pages `seoOf(collection, metadata)`

```ts
import { seoOf } from "@monti-cms/seo";
import { post } from "@/monti.config";

const { title, description, imageId, canonical, noindex } = seoOf(post, entry.metadata);
```

It reads values by role from the collection definition (the result of `defineCollection`) and the stored metadata. An empty title or description is filled from the title (`title`) or summary
(`role: "summary"`), and empty values are `undefined`. The share image is a media ID, so the site builds the public URL
(`cms.read.mediaUrl(id)`, from the `cms` instance the app's `monti.config.ts` exports).

## Entry points

| Entry point | Contents |
| --- | --- |
| `@monti-cms/seo` | `seo`, `seoFields`, `seoOf`, `seoAi`, `SEO_ROLES`, `checkSeoFields` (site config and public pages, shared by server and browser) |
| `@monti-cms/seo/admin` | Admin-side provider (the core loads it through the plugin definition's `admin`) |

## Development

```sh
pnpm --filter @monti-cms/seo test:run     # example blog config + other-site config
pnpm --filter @monti-cms/seo typecheck
```
