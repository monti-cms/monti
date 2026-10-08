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
