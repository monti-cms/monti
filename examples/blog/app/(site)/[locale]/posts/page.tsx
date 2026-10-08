import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Pagination } from "@/components/pagination";
import { metadataText, PostMeta } from "@/components/post-meta";
import { cms } from "@/monti.config";

// The page reads the database on each request. With cacheComponents that needs `instant = false`; leave the line out when the option is off.
export const instant = false;

export const metadata: Metadata = { title: "Posts" };

const PAGE_SIZE = 10;

type Props = {
	params: Promise<{ locale: string }>;
	searchParams: Promise<{ page?: string }>;
};

/** The post list: the newest published posts first, paged. The read API supplies each post's URL and its relation names. */
export default async function PostListPage({ params, searchParams }: Props) {
	await connection();
	const { locale } = await params;
	if (!cms.site.isLocale(locale)) notFound();
	const page = Math.max(1, Math.floor(Number((await searchParams).page ?? 1)) || 1);
	const { items, total, pageSize } = await cms.read.listEntries({
		collection: "post",
		locale,
		page,
		pageSize: PAGE_SIZE,
	});
	return (
		<main className="mx-auto max-w-2xl px-4 py-12">
			<h1 className="mb-8 font-bold text-3xl">Posts</h1>
			<ul className="space-y-8">
				{items.map((entry) => {
					const summary = metadataText(entry, "summary");
					return (
						<li key={entry.id}>
							<h2 className="font-semibold text-xl">
								<Link href={entry.path ?? `/${locale}/posts/${entry.slug}`} className="hover:underline">
									{entry.title ?? entry.slug}
								</Link>
							</h2>
							<PostMeta entry={entry} />
							{summary ? <p className="mt-2 text-neutral-800 dark:text-neutral-200">{summary}</p> : null}
						</li>
					);
				})}
			</ul>
			{items.length === 0 ? <p className="text-neutral-600 dark:text-neutral-400">No posts yet.</p> : null}
			<Pagination page={page} pageSize={pageSize} total={total} />
		</main>
	);
}
