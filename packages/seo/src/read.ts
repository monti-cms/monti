import { type SiteEntry, type SiteImage, siteImage } from "@monti-cms/core";
import { SEO_FIELDS, SEO_FOLLOWS, type SeoFollows } from "./fields";

/** An entry's SEO values as a page's metadata takes them. What is empty is left out. */
export type SeoValues = {
	/** The search title; the entry's title when none was written. */
	title: string;
	/** The search description; the followed field's (the summary's) when none was written. */
	description?: string;
	/** The share image; the followed field's (the cover's) when none was chosen. Its `src` is the file's address. */
	image?: SiteImage;
	canonical?: string;
	/** The page asks search engines to leave it out. */
	noindex: boolean;
};

const words = (value: unknown) => (typeof value === "string" && value.trim() !== "" ? value.trim() : undefined);

/**
 * Reads an entry's SEO values on the site (`generateMetadata`). Give the same `follows` as the plugin was given, when it was given any.
 *
 * ```ts
 * const seo = seoOf(entry);
 * return { title: seo.title, description: seo.description, robots: seo.noindex ? { index: false } : undefined };
 * ```
 */
export function seoOf(entry: Pick<SiteEntry, "title" | "values" | "media">, follows: SeoFollows = {}): SeoValues {
	const from = { ...SEO_FOLLOWS, ...follows };
	const { values } = entry;
	const description = words(values[SEO_FIELDS.description]) ?? words(values[from.description]);
	const image = siteImage(values[SEO_FIELDS.image], entry.media) ?? siteImage(values[from.image], entry.media);
	const canonical = words(values[SEO_FIELDS.canonical]);
	return {
		title: words(values[SEO_FIELDS.title]) ?? entry.title,
		...(description ? { description } : {}),
		...(image ? { image } : {}),
		...(canonical ? { canonical } : {}),
		noindex: values[SEO_FIELDS.noindex] === "noindex",
	};
}
