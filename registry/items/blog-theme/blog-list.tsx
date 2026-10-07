import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pagination } from "./pagination";
import { metadataText, PostMeta } from "./post-meta";
import { blogTheme } from "./theme.config";

/** The route's props. `locale` is there when the page sits under a `[locale]` folder. */
export interface BlogListProps {
	params: Promise<{ locale?: string }>;
	searchParams: Promise<{ page?: string }>;
}

/** The list page: the newest published posts first, paged. The read API supplies each post's URL and its relation names. */
export async function BlogListPage({ params, searchParams }: BlogListProps) {
	const { locale } = await params;
	if (locale !== undefined && !blogTheme.cms.site.isLocale(locale)) notFound();
	const page = Math.max(1, Math.floor(Number((await searchParams).page ?? 1)) || 1);
	const { items, total, pageSize } = await blogTheme.cms.read.listEntries({
		collection: blogTheme.collection,
		locale,
		page,
		pageSize: blogTheme.pageSize,
	});
	return (
		<main className="mx-auto max-w-2xl px-4 py-12">
			<h1 className="mb-8 font-bold text-3xl">{blogTheme.blogTitle}</h1>
			<ul className="space-y-8">
				{items.map((entry) => {
					const excerpt = metadataText(entry, blogTheme.excerptField);
					return (
						<li key={entry.id}>
							<h2 className="font-semibold text-xl">
								<Link href={entry.path ?? `${blogTheme.routeBase}/${entry.slug}`} className="hover:underline">
									{entry.title ?? entry.slug}
								</Link>
							</h2>
							<PostMeta entry={entry} />
							{excerpt ? <p className="mt-2 text-neutral-800 dark:text-neutral-200">{excerpt}</p> : null}
						</li>
					);
				})}
			</ul>
			{items.length === 0 ? <p className="text-neutral-600 dark:text-neutral-400">No posts yet.</p> : null}
			<Pagination page={page} pageSize={pageSize} total={total} />
		</main>
	);
}

/** The title of the list page. */
export async function generateBlogListMetadata({ params }: Pick<BlogListProps, "params">): Promise<Metadata> {
	const { locale } = await params;
	if (locale !== undefined && !blogTheme.cms.site.isLocale(locale)) return {};
	return { title: blogTheme.blogTitle };
}
