import { isLocale, localizePath } from "@monti-cms/core/client";
import type { ReadEntry } from "@monti-cms/core/read";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { ArticleBody } from "@/registry/monti/article-body/article-body";
import { metadataText, PostMeta } from "./post-meta";
import { blogTheme } from "./theme.config";

/** The route's props. `locale` is there when the page sits under a `[locale]` folder. */
export interface BlogPostProps {
	params: Promise<{ locale?: string; slug: string }>;
}

/** The post of the request: a 404 for an unknown, unpublished or foreign-locale address, and a permanent redirect from an old address. */
async function readPost({ params }: BlogPostProps): Promise<ReadEntry> {
	const { locale, slug } = await params;
	if (locale !== undefined && !isLocale(locale)) notFound();
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

/** The detail page: title, byline (date, author, topics), a table of contents and the body (`ArticleBody`), and the newer and older post. */
export async function BlogPostPage(props: BlogPostProps) {
	const entry = await readPost(props);
	const { newer, older } = await neighborsOf(entry);
	return (
		<main className="mx-auto max-w-2xl px-4 py-12">
			<Link
				href={localizePath(entry.locale, blogTheme.routeBase)}
				className="text-neutral-600 text-sm hover:underline dark:text-neutral-400"
			>
				← {blogTheme.blogTitle}
			</Link>
			<h1 className="mt-4 mb-2 font-bold text-3xl">{entry.title ?? entry.slug}</h1>
			<div className="mb-8">
				<PostMeta entry={entry} />
			</div>
			<ArticleBody entry={entry} components={blogTheme.components} />
			{newer || older ? (
				<nav aria-label="More posts" className="mt-12 grid gap-4 sm:grid-cols-2">
					{older ? <Neighbor entry={older} label="Older post" align="left" /> : <span />}
					{newer ? <Neighbor entry={newer} label="Newer post" align="right" /> : <span />}
				</nav>
			) : null}
		</main>
	);
}

/** Title, description (the excerpt) and Open Graph of the post. An unknown address gets no metadata: the page itself answers 404 or redirects. */
export async function generateBlogPostMetadata({ params }: BlogPostProps): Promise<Metadata> {
	const { locale, slug } = await params;
	if (locale !== undefined && !isLocale(locale)) return {};
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
