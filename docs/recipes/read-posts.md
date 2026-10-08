# Read posts on the public site, typed

Goal: a post list (with a tag filter and paging), a single post, and the tags of a post, on the public pages, with results whose types come from the config, so `post.metadata.title` is a `string` and a collection that does not exist is a compile error.

Code: [`examples/recipes/src/read-posts`](../../examples/recipes/src/read-posts). Test: `read-posts.test.ts` (runs against the database, and its `typedResults` function is the type test: `pnpm typecheck` compiles it, and a `@ts-expect-error` line fails the build if it ever starts to compile).

## What you need to know

1. **`cms.read`** reads published content only (`getEntry`, `listEntries`, `getTranslations`, `getPreview`). It resolves relations, public addresses and old addresses ("The CMS instance" in the [core README](../../packages/core/README.md)).
2. **The types follow the config** you pass to `defineConfig`, with no registration step: `Cms<typeof config>`. With a schema file, `monti schema:types` writes the same types into `monti-env.d.ts`.
3. **`getEntry` returns a status**, not an entry: `found`, `redirect` (an old address: redirect with 308 to `path`) or `not_found`.
4. **Relations** arrive in `entry.relations.<field>` (published targets only, in order). To filter a list by a relation, pass the target's `id` in `where: { tagIds: tag.id }`.
5. **Required fields are not optional** in what you read (`PublishedMetadataFor`), because publishing needs them. The optional ones are `T | undefined`.

## The code

The instance of the app (in an app this is `monti.config.ts`):

<!-- source: examples/recipes/src/read-posts/cms.ts -->
```ts
import { defineConfig } from "@monti-cms/core/server";
import type { TestServer } from "@monti-cms/core/testing";
import { mdx } from "@monti-cms/mdx";
import { schema } from "../site";

/**
 * In an app this is `monti.config.ts` (`database: postgres()`, `auth: auth(…)`); the recipe takes the server options as a parameter so a test can give it its own
 * database. The type of the instance, `BlogCms`, is what makes `cms.read` typed: it follows the config you pass, with no registration step.
 */
export const createBlogCms = (server: TestServer["server"]) => defineConfig({ schema, plugins: [mdx()], ...server });

export type BlogCms = ReturnType<typeof createBlogCms>;
```

The reads, as functions the pages call:

<!-- source: examples/recipes/src/read-posts/read-posts.ts -->
```ts
import type { ReadEntry, ReadRelation } from "@monti-cms/core/read";
import type { BlogCms } from "./cms";

/** What a list page needs of a post. `ReadEntry<"post", Config>` knows its metadata (`title: string`, `summary?: string`), so nothing here is cast. */
export interface PostSummary {
	readonly slug: string;
	readonly path: string | null;
	readonly title: string;
	readonly summary: string | undefined;
	readonly publishedAt: Date | null;
	readonly tags: readonly ReadRelation[];
}

const summaryOf = (post: ReadEntry<"post", BlogCms["site"]["config"]>): PostSummary => ({
	slug: post.slug,
	path: post.path,
	title: post.metadata.title,
	summary: post.metadata.summary,
	publishedAt: post.publishedAt,
	tags: post.relations.tagIds ?? [],
});

/** The tag with this slug, or `null`. Tags are an item collection, so the whole list is one small query. */
export async function findTag(cms: BlogCms, slug: string, locale?: string) {
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

## The type test

```ts
const { items } = await cms.read.listEntries({ collection: "post" });
expectTypeOf(items[0].metadata.title).toEqualTypeOf<string>();
// @ts-expect-error "nope" is not a collection of this site
await cms.read.listEntries({ collection: "nope" });
```

## Found while writing it

- The README showed `(await cms.read.getEntry(…)).entry`, which does not compile: the result is a status union. Fixed in the README.
- `post.metadata.title` was `string | undefined` even though a published post always has a title. Fixed: reads use `PublishedMetadataFor`.
- `cms.contentService()` was not typed by the config (any collection, any metadata), and an item collection (a tag) wrongly needed a body. Fixed: `createDraft` and `saveDraft` follow the config, and an item needs no body.
- `{ summary: undefined }` threw `invalid_metadata_type` without naming the field. Fixed: `undefined` means "not set", and the other metadata errors name the field.
