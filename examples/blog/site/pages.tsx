import { type CreateElement, renderDocument, tocOf } from "@monti-cms/core/render";
import { entryPage } from "@monti-cms/next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createElement, type ElementType, type ReactNode } from "react";
import { reader } from "@/lib/monti";

// The pages of the site, each for one language. The routes under `app/(site)` hand them the language of their address: none for Korean (the
// source language), `/en` and `/ja` for the translations.

/** React's `createElement` in the shape Monti's drawing asks for: Monti knows no framework. */
const h: CreateElement<ReactNode> = (type, props, ...children) =>
	createElement(type as ElementType, props, ...(children as ReactNode[]));

/** The language of an address, or not found when the site has no such language. A page without one is in the source language. */
export function localeOf(code?: string): string {
	const { source, list } = reader.locales();
	if (code === undefined) return source;
	// The source language has no prefix: `/ko/posts/…` is no address of this site.
	if (code === source || !list.some((locale) => locale.code === code)) notFound();
	return code;
}

const day = (date: Date | null, locale: string) =>
	date ? new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(date) : "";

/** The first page: the newest posts. */
export async function Home({ locale }: { locale: string }) {
	const { entries } = await reader.page({ collection: "post", locale, limit: 5 });
	return (
		<main>
			<h1>Monti 블로그</h1>
			<PostRows entries={entries} locale={locale} />
			<p>
				<Link href={locale === reader.locales().source ? "/posts" : `/${locale}/posts`}>모든 글</Link>
			</p>
		</main>
	);
}

function PostRows({ entries, locale }: { entries: Awaited<ReturnType<typeof reader.entries>>; locale: string }) {
	if (entries.length === 0) return <p>아직 글이 없습니다.</p>;
	return (
		<ul className="rows">
			{entries.map((entry) => (
				<li key={entry.id}>
					{entry.path ? <Link href={entry.path}>{entry.title}</Link> : entry.title}
					<time>{day(entry.publishedAt, locale)}</time>
				</li>
			))}
		</ul>
	);
}

/** Every post, newest first. */
export async function Posts({ locale }: { locale: string }) {
	return (
		<main>
			<h1>글</h1>
			<PostRows entries={await reader.entries({ collection: "post", locale })} locale={locale} />
		</main>
	);
}

/** A post or a note: its title, its table of contents when it has headings, and its body. */
export async function Entry({
	collection,
	slug,
	locale,
}: {
	collection: "post" | "memo";
	slug: string;
	locale: string;
}) {
	// Not found when there is none, on to the new address when this is an old one, the working copy while its preview is open.
	const entry = await entryPage(reader, { collection, slug, locale });
	const toc = entry.doc ? tocOf(entry.doc) : [];
	const category = entry.relations?.category;
	return (
		<main>
			<article>
				<h1>{entry.title}</h1>
				<p className="meta">
					<time>{day(entry.publishedAt, locale)}</time>
					{category && !Array.isArray(category) ? (
						<Link href={`${locale === reader.locales().source ? "" : `/${locale}`}/categories/${category.slug}`}>
							{category.title}
						</Link>
					) : null}
				</p>
				{toc.length > 0 ? (
					<nav aria-label="목차" className="toc">
						<ol>
							{toc.map((item) => (
								<li key={item.id} data-depth={item.depth}>
									<a href={`#${item.id}`}>{item.text}</a>
								</li>
							))}
						</ol>
					</nav>
				) : null}
				{entry.doc
					? renderDocument(entry.doc, { createElement: h, media: entry.media, entryPath: entry.entryPath })
					: null}
			</article>
		</main>
	);
}

/** A category: its name and the posts in it. */
export async function Category({ slug, locale }: { slug: string; locale: string }) {
	const category = await entryPage(reader, { collection: "category", slug, locale });
	const posts = (await reader.entries({ collection: "post", locale })).filter((post) => {
		const of = post.relations?.category;
		return of && !Array.isArray(of) && of.id === category.id;
	});
	return (
		<main>
			<h1>{category.title}</h1>
			<PostRows entries={posts} locale={locale} />
		</main>
	);
}
