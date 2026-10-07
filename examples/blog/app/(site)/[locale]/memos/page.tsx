import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { PostMeta } from "@/components/monti/blog-theme/post-meta";
import { cms } from "@/monti.config";

// The page waits for the request before anything is sent; with cacheComponents that needs instant = false.
export const instant = false;

export const metadata: Metadata = { title: "Memos" };

type Props = { params: Promise<{ locale: string }> };

/**
 * The memo list: the blog theme has no memo page, so this one is small and written by hand with the same read API.
 * The memos are read on each request: `connection()` before anything is sent, so an unknown language is a real 404. With cacheComponents that needs `instant = false`.
 */
export default async function MemoListPage({ params }: Props) {
	await connection();
	const { locale } = await params;
	if (!cms.site.isLocale(locale)) notFound();
	const { items } = await cms.read.listEntries({ collection: "memo", locale, pageSize: 50 });
	return (
		<main className="mx-auto max-w-2xl px-4 py-12">
			<h1 className="mb-8 font-bold text-3xl">Memos</h1>
			<ul className="space-y-6">
				{items.map((entry) => (
					<li key={entry.id}>
						<h2 className="font-semibold text-xl">
							<Link href={entry.path ?? `/${locale}/memos/${entry.slug}`} className="hover:underline">
								{entry.title ?? entry.slug}
							</Link>
						</h2>
						<PostMeta entry={entry} />
					</li>
				))}
			</ul>
			{items.length === 0 ? <p className="text-neutral-600 dark:text-neutral-400">No memos yet.</p> : null}
		</main>
	);
}
