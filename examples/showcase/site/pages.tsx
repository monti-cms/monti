import { publicPath, type ResolvedRelation, type SiteEntry, type SiteImage, siteImage } from "@monti-cms/core";
import { type CreateElement, renderDocument, tocOf } from "@monti-cms/core/render";
import { entryPage, homePath, type PageEntry, pageMetadata, previewPage } from "@monti-cms/next";
import { type SeoFollows, seoOf } from "@monti-cms/seo";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createElement, type ElementType, type ReactNode } from "react";
import { code, monti, reader } from "@/lib/monti";
import { blocks, marks } from "../monti/blocks/index";
import { SitePage } from "./frame";

// The pages of the site, each for one language. The routes under `app/(site)` hand them no language (the source language, Korean); those
// under `app/[locale]` hand them the one in their address.

/** React's `createElement` in the shape Monti's drawing asks for: Monti knows no framework. */
const h: CreateElement<ReactNode> = (type, props, ...children) =>
	createElement(type as ElementType, props, ...(children as ReactNode[]));

/**
 * The language of an address, or not found when the site's addresses do not show it that way (`locales.prefix`, which Settings ›
 * Languages changes). A page without one is in the source language.
 */
export function localeOf(code?: string): string {
	const { source, list, prefix } = reader.locales();
	// With a prefix on every language, an address without one is none of the site's.
	if (code === undefined) {
		if (prefix === "always") notFound();
		return source;
	}
	// With no prefix at all, every language is at the bare address; the source has one only when every language has.
	if (prefix === "never" || (code === source && prefix !== "always")) notFound();
	if (!list.some((locale) => locale.code === code)) notFound();
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

const day = (date: Date | null, locale: string) =>
	date ? new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(date) : "";

/** Where an entry a field points at has its page, in the language it was found in; `null` for an item with no page. */
const pathOf = (relation: ResolvedRelation) =>
	publicPath(monti.site.schema(), relation.collection, relation.slug, relation.locale);

const many = (value: ResolvedRelation | ResolvedRelation[] | null | undefined) =>
	Array.isArray(value) ? value : value ? [value] : [];

const text = (value: unknown) => (typeof value === "string" && value.trim() !== "" ? value : null);
const words = (value: unknown) => (Array.isArray(value) ? value.filter((item) => typeof item === "string") : []);

/**
 * A picture of a media field, at its own size or the width given (its height follows). A plain `<img>`: the file's address is the
 * storage's (this site's admin API, or a bucket), which Next's image optimizer is not set up for here.
 */
function Picture({ image, className, width }: { image: SiteImage; className?: string; width?: number }) {
	const shown = width ?? image.width;
	return (
		// biome-ignore lint/performance/noImgElement: the storage's own address, drawn as it is (see above)
		<img
			className={className}
			src={image.src}
			alt={image.alt}
			width={shown}
			height={Math.round((shown * image.height) / image.width)}
		/>
	);
}

function RelationLinks({ value }: { value: ResolvedRelation | ResolvedRelation[] | null | undefined }) {
	const list = many(value);
	if (list.length === 0) return <>—</>;
	return (
		<>
			{list.map((relation, index) => {
				const path = pathOf(relation);
				return (
					<span key={relation.id}>
						{index > 0 ? ", " : null}
						{path ? <Link href={path}>{relation.title}</Link> : relation.title}
						{/* Shown from the source language: this one has no page in the page's language. */}
						{relation.fallback ? <small> ({relation.locale})</small> : null}
					</span>
				);
			})}
		</>
	);
}

function EntryRows({ entries, locale }: { entries: SiteEntry[]; locale: string }) {
	if (entries.length === 0) return <p className="quiet">Nothing published here yet.</p>;
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

/** The first page: every collection of the site, as this language has it. */
export async function Home({ locale }: { locale: string }) {
	const [{ entries: articles, next }, tags, people, series] = await Promise.all([
		reader.page({ collection: "article", locale, limit: 20 }),
		reader.entries({ collection: "tag", locale }),
		reader.entries({ collection: "person", locale }),
		reader.entries({ collection: "series", locale }),
	]);
	return (
		<SitePage locale={locale}>
			<h1>Monti showcase</h1>
			<h2>Articles</h2>
			<EntryRows entries={articles} locale={locale} />
			{next ? <p className="quiet">More than twenty: the reader pages them.</p> : null}
			<h2>Tags</h2>
			<EntryRows entries={tags} locale={locale} />
			<h2>People</h2>
			<EntryRows entries={people} locale={locale} />
			<h2>Series</h2>
			{/* Items with no page: only their names and values are read. */}
			<ul className="rows">
				{series.map((item) => (
					<li key={item.id}>
						{item.title}
						<span className="quiet">{text(item.values.note) ?? ""}</span>
					</li>
				))}
			</ul>
		</SitePage>
	);
}

/** The first page's search and share values: its own address, and the first page of each other language. */
export function homeMetadata(locale: string): Metadata {
	const locales = reader.locales();
	// With no language in any address every language's first page is the one address: there is no other to name.
	const others = locales.prefix === "never" ? [] : locales.list.filter(({ code }) => code !== locale);
	return {
		...pageMetadata({
			title: "Monti showcase",
			locale,
			path: homePath(locales, locale),
			translations: others.map(({ code }) => ({ locale: code, path: homePath(locales, code) })),
		}),
		// The site's name alone, not "name · name" (the layout's title template).
		title: { absolute: "Monti showcase" },
	};
}

/**
 * An entry's page's search and share values: the SEO plugin's fields where the collection has them, the entry's own otherwise (`follows`),
 * its own address as the canonical one, and the entry's pages in the other languages.
 */
async function entryMetadata(
	collection: string,
	slug: string,
	locale: string,
	follows?: SeoFollows,
): Promise<Metadata> {
	const found = await reader.entry({ collection, slug: decoded(slug), locale });
	if (!found || !("entry" in found)) return {};
	const { entry } = found;
	return pageMetadata({ ...seoOf(entry, follows), locale, path: entry.path, translations: entry.translations });
}

export const articleMetadata = (slug: string, locale: string) => entryMetadata("article", slug, locale);
export const tagMetadata = (slug: string, locale: string) =>
	entryMetadata("tag", slug, locale, { description: "description" });
export const personMetadata = (slug: string, locale: string) =>
	entryMetadata("person", slug, locale, { description: "bio", image: "photo" });

/** The fields of the option an article's conditional field has chosen (the reader gives only those). */
function Format({ entry }: { entry: PageEntry }) {
	const { values } = entry;
	const format = text(values.format);
	if (!format) return null;
	const poster = siteImage(values.galleryPoster, entry.media);
	const target = entry.relations?.linkTarget;
	return (
		<dl className="fields">
			<dt>Format</dt>
			<dd>{format}</dd>
			{format === "video" ? (
				<>
					<dt>Video</dt>
					<dd>
						<a href={text(values.videoUrl) ?? "#"}>{text(values.videoUrl)}</a>
						{text(values.videoLength) ? ` (${values.videoLength})` : null}
					</dd>
				</>
			) : null}
			{format === "gallery" ? (
				<>
					<dt>Layout</dt>
					<dd>{text(values.galleryLayout) ?? "—"}</dd>
					{poster ? (
						<>
							<dt>Poster</dt>
							<dd>
								<Picture image={poster} width={poster.width / 4} />
							</dd>
						</>
					) : null}
				</>
			) : null}
			{format === "link" ? (
				<>
					<dt>Link</dt>
					<dd>
						{values.linkKind === "external" ? <a href={text(values.linkUrl) ?? "#"}>{text(values.linkUrl)}</a> : null}
						{values.linkKind === "internal" ? <RelationLinks value={target} /> : null}
						{values.linkKind ? null : "—"}
					</dd>
				</>
			) : null}
		</dl>
	);
}

async function Body({ entry }: { entry: PageEntry }) {
	if (!entry.doc) return null;
	const toc = tocOf(entry.doc);
	return (
		<>
			{toc.length > 0 ? (
				<nav aria-label="Contents" className="toc">
					<ol>
						{toc.map((item) => (
							<li key={item.id} data-depth={item.depth}>
								<a href={`#${item.id}`}>{item.text}</a>
							</li>
						))}
					</ol>
				</nav>
			) : null}
			<div className="body">
				{renderDocument(entry.doc, {
					blocks,
					marks,
					createElement: h,
					media: entry.media,
					entryPath: entry.entryPath,
					code: await code,
					locale: entry.locale,
				})}
			</div>
		</>
	);
}

/** An article: every field it has, then its body. */
function ArticleView({ entry, locale }: { entry: PageEntry; locale: string }) {
	const { values, relations } = entry;
	const cover = siteImage(values.cover, entry.media);
	const attachment = values.attachment as { media?: string } | undefined;
	const file = attachment?.media ? entry.media?.[attachment.media] : undefined;
	return (
		<article>
			{values.pinned === "pinned" ? <p className="pin">📌 {text(values.pinNote) ?? "Pinned"}</p> : null}
			<h1>{entry.title}</h1>
			{text(values.subtitle) ? <p className="subtitle">{text(values.subtitle)}</p> : null}
			<p className="meta">
				<time>{entry.preview ? "Preview" : day(entry.publishedAt, locale)}</time>
				<span>{text(values.topic)}</span>
				{words(values.seasons).length > 0 ? <span>{words(values.seasons).join(" · ")}</span> : null}
			</p>
			{cover ? <Picture image={cover} className="cover" /> : null}
			{text(values.summary) ? <p className="summary">{text(values.summary)}</p> : null}
			<dl className="fields">
				<dt>Series</dt>
				<dd>
					<RelationLinks value={relations?.series} />
				</dd>
				<dt>Authors</dt>
				<dd>
					<RelationLinks value={relations?.authors} />
				</dd>
				<dt>Tags</dt>
				<dd>
					<RelationLinks value={relations?.tags} />
				</dd>
				<dt>Attachment</dt>
				<dd>{file ? <a href={file.url}>{file.name}</a> : "—"}</dd>
			</dl>
			<Format entry={entry} />
			<Body entry={entry} />
			{many(relations?.related).length > 0 ? (
				<aside>
					<h2>Related</h2>
					<RelationLinks value={relations?.related} />
				</aside>
			) : null}
		</article>
	);
}

export async function Article({ slug, locale }: { slug: string; locale: string }) {
	// Not found when there is none, on to the new address when this is an old one, the working copy while its preview is open.
	const entry = await entryPage(reader, { collection: "article", slug, locale });
	return (
		<SitePage locale={locale} path={entry.path} translations={entry.translations}>
			<ArticleView entry={entry} locale={locale} />
		</SitePage>
	);
}

/** The site's own preview page (the collection's `previewPath`): only the working copy, only for the one who opened its preview. */
export async function ArticlePreview({ slug, locale }: { slug: string; locale: string }) {
	const entry = await previewPage(reader, { collection: "article", slug, locale });
	// The languages go to what is published: the working copy has no page there.
	return (
		<SitePage locale={locale} translations={entry.translations}>
			<ArticleView entry={entry} locale={locale} />
		</SitePage>
	);
}

/** Whether a field points at this entry: the reader finds a relation in the page's language first, so it is this very entry. */
const pointsAt = (value: ResolvedRelation | ResolvedRelation[] | null | undefined, entry: SiteEntry) =>
	many(value).some((relation) => relation.id === entry.id);

/** A tag: its description and the articles that have it. */
export async function Tag({ slug, locale }: { slug: string; locale: string }) {
	const tag = await entryPage(reader, { collection: "tag", slug, locale });
	const articles = (await reader.entries({ collection: "article", locale })).filter((article) =>
		pointsAt(article.relations?.tags, tag),
	);
	return (
		<SitePage locale={locale} path={tag.path} translations={tag.translations}>
			<h1># {tag.title}</h1>
			{text(tag.values.description) ? <p>{text(tag.values.description)}</p> : null}
			<EntryRows entries={articles} locale={locale} />
		</SitePage>
	);
}

/** A person: their photo, bio and roles, and the articles that name them as an author. */
export async function Person({ slug, locale }: { slug: string; locale: string }) {
	const person = await entryPage(reader, { collection: "person", slug, locale });
	const photo = siteImage(person.values.photo, person.media);
	const articles = (await reader.entries({ collection: "article", locale })).filter((article) =>
		pointsAt(article.relations?.authors, person),
	);
	return (
		<SitePage locale={locale} path={person.path} translations={person.translations}>
			{photo ? <Picture image={photo} className="photo" width={120} /> : null}
			<h1>{person.title}</h1>
			<p className="meta">{words(person.values.roles).join(" · ")}</p>
			{text(person.values.bio) ? <p>{text(person.values.bio)}</p> : null}
			<EntryRows entries={articles} locale={locale} />
		</SitePage>
	);
}
