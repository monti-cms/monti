import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { connection } from "next/server";
import { ArticleBody } from "@/components/monti/article-body/article-body";
import { PostMeta } from "@/components/post-meta";
import { cms } from "@/monti.config";

// The page waits for the request before anything is sent; with cacheComponents that needs instant = false.
export const instant = false;

type Props = { params: Promise<{ locale: string; slug: string }> };

/** The memo of the request: a 404 for an unknown, unpublished or foreign-language address, and a permanent redirect from an old address. */
async function readMemo({ params }: Props) {
	const { locale, slug } = await params;
	if (!cms.site.isLocale(locale)) notFound();
	const result = await cms.read.getEntry({ collection: "memo", slug: decodeURIComponent(slug), locale });
	if (result.status === "not_found") notFound();
	if (result.status === "redirect") permanentRedirect(result.path ?? result.slug);
	return result.entry;
}

/** The memo is read on each request. `notFound()` and `permanentRedirect()` give a real 404 and 308 when cacheComponents is off (see the post page for the trade-off). */
export default async function MemoPage(props: Props) {
	await connection();
	const entry = await readMemo(props);
	return (
		<main className="mx-auto max-w-2xl px-4 py-12">
			<Link
				href={cms.site.localizePath(entry.locale, "/memos")}
				className="text-neutral-600 text-sm hover:underline dark:text-neutral-400"
			>
				← Memos
			</Link>
			<h1 className="mt-4 mb-2 font-bold text-3xl">{entry.title ?? entry.slug}</h1>
			<div className="mb-8">
				<PostMeta entry={entry} />
			</div>
			<ArticleBody cms={cms} entry={entry} toc={false} />
		</main>
	);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
	await connection();
	const { locale, slug } = await params;
	if (!cms.site.isLocale(locale)) return {};
	const result = await cms.read.getEntry({ collection: "memo", slug: decodeURIComponent(slug), locale });
	return result.status === "found" ? { title: result.entry.title ?? result.entry.slug } : {};
}
