import { isLocale } from "@monti-cms/core/client";
import { getEntry } from "@monti-cms/core/read";
import { createPublicImageResolver, renderMdx } from "@monti-cms/core/render";
import { notFound, permanentRedirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** 글 하나. 옛 주소면 새 주소로 옮기고, 본문은 본체 렌더(블록 확장의 공개 컴포넌트 포함)로 그린다. */
export default async function ArticlePage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
	const { locale, slug } = await params;
	if (!isLocale(locale)) notFound();
	const result = await getEntry({ collection: "article", slug: decodeURIComponent(slug), locale });
	if (result.status === "not_found") notFound();
	if (result.status === "redirect") permanentRedirect(result.path ?? result.slug);
	const { entry } = result;
	const { content, toc } = await renderMdx(entry.mdx, {
		locale,
		imageResolver: await createPublicImageResolver(entry.mdx),
	});
	return (
		<main className="mx-auto max-w-2xl px-4 py-12">
			<h1 className="mb-2 font-bold text-3xl">{entry.title}</h1>
			<p className="mb-8 text-sm opacity-70">
				{entry.relations.authorId?.[0]?.title}
				{entry.publishedAt ? ` · ${entry.publishedAt.toISOString().slice(0, 10)}` : ""}
			</p>
			{toc.length > 0 ? (
				<nav className="mb-8 text-sm">
					<ul>
						{toc.map((item) => (
							<li key={item.href} style={{ marginLeft: item.depth * 12 }}>
								<a href={item.href}>{item.value}</a>
							</li>
						))}
					</ul>
				</nav>
			) : null}
			<article className="prose dark:prose-invert max-w-none">{content}</article>
		</main>
	);
}
