# Read posts on the public site, typed

Goal: a post list (with a tag filter and paging), a single post, and the tags of a post, on the public pages, with results whose types come from the config, so `post.metadata.title` is a `string` and a collection that does not exist is a compile error.

The snippets below are a sketch to adapt, not tested code.

## What you need to know

1. **`cms.read`** reads published content only (`getEntry`, `listEntries`, `getTranslations`, `getPreview`). It resolves relations, public addresses and old addresses ("The CMS instance" in the [core README](../../packages/core/README.md)).
2. **The types follow the config** you pass to `defineConfig`, with no registration step: `Cms<typeof config>`. With a schema file, `monti schema:types` writes the same types into `monti-env.d.ts`.
3. **`getEntry` returns a status**, not an entry: `found`, `redirect` (an old address: redirect with 308 to `path`) or `not_found`.
4. **Relations** arrive in `entry.relations.<field>` (published targets only, in order). To filter a list by a relation, pass the target's `id` in `where: { tagIds: tag.id }`.
5. **Required fields are not optional** in what you read (`PublishedMetadataFor`), because publishing needs them. The optional ones are `T | undefined`.

## A sketch

The instance (in an app this is `monti.config.ts`), and its type:

```ts
export const cms = defineConfig({ schema, plugins: [mdx()], database: postgres() /* ... */ });
export type BlogCms = typeof cms;
```

The reads, as functions the pages call:

```ts
import type { ReadEntry, ReadRelation } from "@monti-cms/core/read";

interface PostSummary {
	slug: string;
	path: string | null;
	title: string;
	summary: string | undefined;
	publishedAt: Date | null;
	tags: readonly ReadRelation[];
}

// `ReadEntry<"post", Config>` knows its metadata (`title: string`, `summary?: string`), so nothing is cast.
const summaryOf = (post: ReadEntry<"post", BlogCms["site"]["config"]>): PostSummary => ({
	slug: post.slug,
	path: post.path,
	title: post.metadata.title,
	summary: post.metadata.summary,
	publishedAt: post.publishedAt,
	tags: post.relations.tagIds ?? [],
});

async function findTag(cms: BlogCms, slug: string, locale?: string) {
	const { items } = await cms.read.listEntries({ collection: "tag", locale, pageSize: 100 });
	return items.find((tag) => tag.slug === slug) ?? null;
}

/** One page of posts, newest first, optionally only those with a tag. `null` when the tag does not exist (the page answers 404). */
export async function listPosts(cms: BlogCms, options: { tag?: string; page?: number; locale?: string } = {}) {
	const tag = options.tag ? await findTag(cms, options.tag, options.locale) : undefined;
	if (options.tag && !tag) return null;
	const { items, total, pageSize } = await cms.read.listEntries({
		collection: "post",
		locale: options.locale,
		page: options.page ?? 1,
		pageSize: 10,
		...(tag ? { where: { tagIds: tag.id } } : {}),
	});
	return { posts: items.map(summaryOf), pages: Math.max(1, Math.ceil(total / pageSize)), tag };
}

/** One post by its address. An old address answers `{ redirectTo }` (the page redirects with 308), an unknown one `null` (404). */
export async function getPost(cms: BlogCms, slug: string, locale?: string) {
	const result = await cms.read.getEntry({ collection: "post", slug, locale });
	if (result.status === "not_found") return null;
	if (result.status === "redirect") return { redirectTo: result.path ?? result.slug };
	return { post: summaryOf(result.entry), entry: result.entry };
}
```

A page then reads like this (Next.js, App Router):

```tsx
// app/posts/[slug]/page.tsx
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
	const found = await getPost(cms, (await params).slug);
	if (!found) notFound();
	if ("redirectTo" in found) permanentRedirect(found.redirectTo);
	return <CmsContent cms={cms} entry={found.entry} />;
}
```

## The types

The compiler checks the collection name and the metadata:

```ts
const { items } = await cms.read.listEntries({ collection: "post" });
const title: string = items[0].metadata.title;
// @ts-expect-error "nope" is not a collection of this site
await cms.read.listEntries({ collection: "nope" });
```
