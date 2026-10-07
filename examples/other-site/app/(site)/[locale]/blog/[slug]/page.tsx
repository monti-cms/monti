import { isLocale } from "@monti-cms/core/client";
import { notFound, permanentRedirect } from "next/navigation";
import { ArticleBody } from "@/components/monti/article-body/article-body";
import { cms } from "../../../../../cms.server";
import { siteComponents } from "../../../../components/site-blocks";

export const dynamic = "force-dynamic";

/** A single article. An old URL redirects to the new one, and the body is `ArticleBody`, a component installed as source with `monti add article-body` (see `components/monti`), which draws the stored document with the core renderer and the table of contents. */
export default async function ArticlePage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
	const { locale, slug } = await params;
	if (!isLocale(locale)) notFound();
	const result = await cms.read.getEntry({ collection: "article", slug: decodeURIComponent(slug), locale });
	if (result.status === "not_found") notFound();
	if (result.status === "redirect") permanentRedirect(result.path ?? result.slug);
	const { entry } = result;
	return (
		<main className="mx-auto max-w-2xl px-4 py-12">
			<h1 className="mb-2 font-bold text-3xl">{entry.title}</h1>
			<p className="mb-8 text-sm opacity-70">
				{entry.relations.authorId?.[0]?.title}
				{entry.publishedAt ? ` · ${entry.publishedAt.toISOString().slice(0, 10)}` : ""}
			</p>
			<ArticleBody entry={entry} components={siteComponents} />
		</main>
	);
}
