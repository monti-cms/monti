import type { SiteReader, SiteTranslation } from "@monti-cms/core";
import type { Metadata } from "next";

/** The site's languages, as `reader.locales()` gives them. */
type Locales = ReturnType<SiteReader["locales"]>;

/** A page of the site, as its language links and its metadata take it. */
type Page = {
	locale: string;
	/** The page's own address; `null` or none for a page with no address of its own. */
	path?: string | null;
	/** The same page in the other languages (`SiteEntry.translations`, or the site's own for a list page). */
	translations?: readonly SiteTranslation[];
};

/** The site's first page in a language, as the site's addresses show languages (`locales.prefix`). */
export function homePath(locales: Locales, locale: string): string {
	const { source, prefix } = locales;
	return prefix === "always" || (prefix === "exceptSource" && locale !== source) ? `/${locale}` : "/";
}

/** One language of the site's language switcher. */
export type LanguageLink = {
	locale: string;
	name: string;
	href: string;
	/** The language of the page being shown. */
	current: boolean;
};

/**
 * The links of a language switcher (doc 16): each language goes to this same page in that language, and to that language's first page when the
 * page is not there in it.
 *
 * ```tsx
 * languageLinks(reader.locales(), entry).map((link) => <Link key={link.locale} href={link.href}>{link.name}</Link>)
 * ```
 */
export function languageLinks(locales: Locales, page: Page): LanguageLink[] {
	return locales.list.map(({ code, name }) => {
		const current = code === page.locale;
		const there = current ? page.path : page.translations?.find((translation) => translation.locale === code)?.path;
		return { locale: code, name, href: there ?? homePath(locales, code), current };
	});
}

/** What a page says of itself to search engines and to where it is shared. `seoOf(entry)` (`@monti-cms/seo`) gives the first five. */
export type PageMeta = Page & {
	title: string;
	description?: string;
	/** The share image: a `SiteImage`. */
	image?: { src: string; width: number; height: number; alt?: string };
	/** The address the author named as the page's canonical one. Without it the page's own address is. */
	canonical?: string;
	/** The page asks search engines to leave it out. */
	noindex?: boolean;
};

/**
 * A page's metadata for Next (`generateMetadata`, doc 16): its title and description, its canonical address (its own unless the author named
 * another), the same page in the other languages (`hreflang`), and the share values (`og:title`, `og:url`, `og:image`, the card). Addresses are
 * paths: the site's `metadataBase` makes them whole.
 *
 * ```ts
 * const { entry } = found;
 * return pageMetadata({ ...seoOf(entry), locale: entry.locale, path: entry.path, translations: entry.translations });
 * ```
 */
export function pageMetadata(page: PageMeta): Metadata {
	const { title, description, image } = page;
	const url = page.canonical ?? page.path ?? undefined;
	// The other languages are named only by a page that stands for itself: one that points elsewhere, or hides, names none (a search engine
	// drops the set when one of its pages is not canonical).
	const own = page.path && !page.canonical && !page.noindex ? page.path : null;
	const languages =
		own && page.translations && page.translations.length > 0
			? Object.fromEntries([
					[page.locale, own],
					...page.translations.map((translation) => [translation.locale, translation.path]),
				])
			: undefined;
	const images = image
		? [{ url: image.src, width: image.width, height: image.height, ...(image.alt ? { alt: image.alt } : {}) }]
		: undefined;
	return {
		title,
		...(description ? { description } : {}),
		...(url ? { alternates: { canonical: url, ...(languages ? { languages } : {}) } } : {}),
		...(page.noindex ? { robots: { index: false } } : {}),
		openGraph: {
			title,
			...(description ? { description } : {}),
			...(url ? { url } : {}),
			...(images ? { images } : {}),
		},
		twitter: {
			card: images ? "summary_large_image" : "summary",
			title,
			...(description ? { description } : {}),
			...(images ? { images } : {}),
		},
	};
}
