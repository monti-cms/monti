import type { ReadEntry } from "@monti-cms/core/read";
import { previewEntry } from "@monti-cms/nextjs";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { connection } from "next/server";
import { ArticleBody } from "@/components/monti/article-body/article-body";
import { metadataText, PostMeta } from "./post-meta";
import { blogTheme } from "./theme.config";

/** The route's props. `locale` is there when the page sits under a `[locale]` folder. */
export interface BlogPostProps {
	params: Promise<{ locale?: string; slug: string }>;
}

/** What `readPost` reads: the published post, or the draft the signed-in admin previews. */
type PostSource = "published" | "preview";

/** The post of the request: a 404 for an unknown, unpublished or foreign-locale address, and a permanent redirect from an old address. */
async function readPost({ params }: BlogPostProps, source: PostSource = "published"): Promise<ReadEntry> {
	const { locale, slug } = await params;
	if (locale !== undefined && !blogTheme.cms.site.isLocale(locale)) notFound();
	if (source === "preview") {
		// `previewEntry` attaches the request headers first, so the admin session is read even on the first request after a cold start. Anyone else gets a 404.
		const draft = await previewEntry(blogTheme.cms, {
			collection: blogTheme.collection,
			slug: decodeURIComponent(slug),
			locale,
		});
		if (!draft) notFound();
		return draft;
	}
	const result = await blogTheme.cms.read.getEntry({
		collection: blogTheme.collection,
		slug: decodeURIComponent(slug),
		locale,
	});
	if (result.status === "not_found") notFound();
	if (result.status === "redirect") permanentRedirect(result.path ?? result.slug);
	return result.entry;
}

/** The post before and after this one (older and newer), looked up among the newest `neighborWindow` posts. None when the post is outside that window. */
async function neighborsOf(entry: ReadEntry): Promise<{ newer?: ReadEntry; older?: ReadEntry }> {
	if (blogTheme.neighborWindow <= 0) return {};
	const { items } = await blogTheme.cms.read.listEntries({
		collection: blogTheme.collection,
		locale: entry.locale,
		pageSize: blogTheme.neighborWindow,
	});
	const index = items.findIndex((item) => item.id === entry.id);
	return index === -1 ? {} : { newer: items[index - 1], older: items[index + 1] };
}

function Neighbor({ entry, label, align }: { entry: ReadEntry; label: string; align: "left" | "right" }) {
	return (
		<Link
			href={entry.path ?? `${blogTheme.routeBase}/${entry.slug}`}
			className={`block rounded-lg border border-neutral-300 p-4 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900 ${align === "right" ? "text-right" : ""}`}
		>
			<span className="block text-neutral-600 text-xs dark:text-neutral-400">{label}</span>
			<span className="font-medium">{entry.title ?? entry.slug}</span>
		</Link>
	);
}

/**
 * The detail page: title, byline (date, author, topics), a table of contents and the body (`ArticleBody`), and the newer and older post.
 *
 * The post is read on each request: `connection()` opts out of prerendering, and the lookup runs before anything is sent, so an unknown address answers a real
 * 404 and an old address a real 308 (inside a `Suspense` boundary the page would already be streaming with a 200). Under Next's Cache Components
 * (`cacheComponents: true`) a page that waits for the request like this has to say it may block: the route file exports `instant = false` (`monti add` writes it
 * when `next.config` turns the option on; Next rejects it when the option is off). Route segment settings such as `dynamic` are not used: Cache Components rejects them.
 */
export async function BlogPostPage(props: BlogPostProps, source: PostSource = "published") {
	await connection();
	const entry = await readPost(props, source);
	const { newer, older } = await neighborsOf(entry);
	return (
		<main className="mx-auto max-w-2xl px-4 py-12">
			<Link
				href={blogTheme.cms.site.localizePath(entry.locale, blogTheme.routeBase)}
				className="text-neutral-600 text-sm hover:underline dark:text-neutral-400"
			>
				← {blogTheme.blogTitle}
			</Link>
			<h1 className="mt-4 mb-2 font-bold text-3xl">{entry.title ?? entry.slug}</h1>
			<div className="mb-8">
				<PostMeta entry={entry} />
			</div>
			<ArticleBody cms={blogTheme.cms} entry={entry} components={blogTheme.components} />
			{newer || older ? (
				<nav aria-label="More posts" className="mt-12 grid gap-4 sm:grid-cols-2">
					{older ? <Neighbor entry={older} label="Older post" align="left" /> : <span />}
					{newer ? <Neighbor entry={newer} label="Newer post" align="right" /> : <span />}
				</nav>
			) : null}
		</main>
	);
}

/**
 * The preview page of a post (`site.previewPath`, for example `/preview/blog/<slug>`): the same page as the post, over the draft the admin is editing. It shows only
 * to a signed-in admin (in `next dev`, you), and is a 404 for everyone else.
 */
export function BlogPostPreviewPage(props: BlogPostProps) {
	return BlogPostPage(props, "preview");
}

/** A preview is never indexed. */
export const generateBlogPostPreviewMetadata = async (): Promise<Metadata> => ({
	robots: { index: false, follow: false },
});

/** Title, description (the excerpt) and Open Graph of the post. An unknown address gets no metadata: the page itself answers 404 or redirects. */
export async function generateBlogPostMetadata({ params }: BlogPostProps): Promise<Metadata> {
	await connection();
	const { locale, slug } = await params;
	if (locale !== undefined && !blogTheme.cms.site.isLocale(locale)) return {};
	const result = await blogTheme.cms.read.getEntry({
		collection: blogTheme.collection,
		slug: decodeURIComponent(slug),
		locale,
	});
	if (result.status !== "found") return {};
	const { entry } = result;
	const title = entry.title ?? entry.slug;
	const description = metadataText(entry, blogTheme.excerptField);
	return {
		title,
		description,
		alternates: entry.path ? { canonical: entry.path } : undefined,
		openGraph: {
			type: "article",
			title,
			description,
			publishedTime: entry.publishedAt?.toISOString(),
			modifiedTime: entry.updatedAt.toISOString(),
		},
	};
}
