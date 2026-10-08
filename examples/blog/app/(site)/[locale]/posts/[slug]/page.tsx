import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { connection } from "next/server";
import { metadataText } from "@/components/post-meta";
import { PostView } from "@/components/post-view";
import { cms } from "@/monti.config";

// The page reads the database on each request. With cacheComponents that needs `instant = false`; leave the line out when the option is off.
// Status codes: with cacheComponents off, `notFound()` and `permanentRedirect()` send a real 404 and 308. With it on, Next has already sent
// the page's shell with a 200, so an unknown post is a `noindex` page and an old address a client-side redirect. For strict statuses
// see docs/recipes/strict-status.md (a proxy.ts).
export const instant = false;

type Props = { params: Promise<{ locale: string; slug: string }> };

/** The post of the request: a 404 for an unknown, unpublished or foreign-language address, and a permanent redirect from an old address. */
export default async function PostPage({ params }: Props) {
	await connection();
	const { locale, slug } = await params;
	if (!cms.site.isLocale(locale)) notFound();
	const result = await cms.read.getEntry({ collection: "post", slug: decodeURIComponent(slug), locale });
	if (result.status === "not_found") notFound();
	if (result.status === "redirect") permanentRedirect(result.path ?? result.slug);
	return <PostView entry={result.entry} />;
}

/** Title, description (the summary) and Open Graph of the post. An unknown address gets no metadata: the page itself answers 404 or redirects. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
	await connection();
	const { locale, slug } = await params;
	if (!cms.site.isLocale(locale)) return {};
	const result = await cms.read.getEntry({ collection: "post", slug: decodeURIComponent(slug), locale });
	if (result.status !== "found") return {};
	const { entry } = result;
	const title = entry.title ?? entry.slug;
	const description = metadataText(entry, "summary");
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
