import type { SiteTranslation } from "@monti-cms/core";
import { type CreateElement, renderDocument, tocOf } from "@monti-cms/core/render";
import { entryPage, homePath, pageMetadata } from "@monti-cms/next";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createElement, type ElementType, type ReactNode } from "react";
import { code, reader } from "@/lib/monti";
import { blocks, marks } from "../monti/blocks/index";
import { SitePage } from "./frame";

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

/**
 * The language a layout draws its document in. A layout refuses no address: Next cannot draw the site's own "not found" page for what a
 * layout refuses, so the page under it does (`localeOf`), and an address in no language of the site is drawn in the source language.
 */
export function frameLocale(code?: string): string {
	const { source, list } = reader.locales();
	return code !== undefined && list.some((locale) => locale.code === code) ? code : source;
}

/** A slug as it is in the address: Next hands a non-ASCII segment over still encoded, and a broken escape is no slug. */
function decoded(slug: string): string {
	try {
		return decodeURIComponent(slug);
	} catch {
		return slug;
	}
}

/** A page that is no entry's (the first page, the list of posts), in a language: `under` is its address after the language. */
function listPage(locale: string, under: "" | "/posts"): { path: string; translations: SiteTranslation[] } {
	const locales = reader.locales();
	const at = (code: string) =>
		under && homePath(locales, code) === "/" ? under : `${homePath(locales, code)}${under}`;
	return {
		path: at(locale),
		// The same page in the other languages, where it has an address of its own: with no language in any address (`prefix: "never"`)
		// every language's page is this one address, and there is no other to name or to switch to.
		translations: locales.list
			.filter(({ code }) => code !== locale && at(code) !== at(locale))
			.map(({ code }) => ({ locale: code, path: at(code) })),
	};
}

/** The search and share values of the first page (`""`) and of the list of posts: its own address, and the same page in each other language. */
export function listMetadata(locale: string, under: "" | "/posts"): Metadata {
	const meta = pageMetadata({ title: under ? "글" : "Monti 블로그", locale, ...listPage(locale, under) });
	// The first page is the site's name alone, not "name · name" (the layout's title template).
	return under ? meta : { ...meta, title: { absolute: "Monti 블로그" } };
}

/** An entry's page's search and share values: its title, a post's summary, its own address, and its pages in the other languages. */
export async function entryMetadata(
	collection: "post" | "memo" | "category",
	slug: string,
	locale: string,
): Promise<Metadata> {
	const found = await reader.entry({ collection, slug: decoded(slug), locale });
	if (!found || !("entry" in found)) return {};
	const { entry } = found;
	const summary = entry.values.summary;
	return pageMetadata({
		title: entry.title,
		...(typeof summary === "string" && summary.trim() !== "" ? { description: summary } : {}),
		locale,
		path: entry.path,
		translations: entry.translations,
	});
}

const day = (date: Date | null, locale: string) =>
	date ? new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(date) : "";

/** The first page: the newest posts. */
export async function Home({ locale }: { locale: string }) {
	const { entries } = await reader.page({ collection: "post", locale, limit: 5 });
	return (
		<SitePage locale={locale} {...listPage(locale, "")}>
			<h1>Monti 블로그</h1>
			<PostRows entries={entries} locale={locale} />
			<p>
				<Link href={listPage(locale, "/posts").path}>모든 글</Link>
			</p>
		</SitePage>
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
		<SitePage locale={locale} {...listPage(locale, "/posts")}>
			<h1>글</h1>
			<PostRows entries={await reader.entries({ collection: "post", locale })} locale={locale} />
		</SitePage>
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
		<SitePage locale={locale} path={entry.path} translations={entry.translations}>
			<article>
				<h1>{entry.title}</h1>
				<p className="meta">
					<time>{day(entry.publishedAt, locale)}</time>
					{category && !Array.isArray(category) ? (
						// In the category's own language: one with no page in this language is shown from the source language, and its page is there.
						<Link
							href={`${category.locale === reader.locales().source ? "" : `/${category.locale}`}/categories/${category.slug}`}
						>
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
					? renderDocument(entry.doc, {
							blocks,
							marks,
							createElement: h,
							media: entry.media,
							entryPath: entry.entryPath,
							code: await code,
							// The blocks' own words (a callout's kind, "Show more") and the code block's in the entry's language.
							locale,
						})
					: null}
			</article>
		</SitePage>
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
		<SitePage locale={locale} path={category.path} translations={category.translations}>
			<h1>{category.title}</h1>
			<PostRows entries={posts} locale={locale} />
		</SitePage>
	);
}
