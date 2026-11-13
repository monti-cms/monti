/**
 * The plugin's names and defaults, apart from the plugin itself: the browser half (`admin.tsx`) imports these, and nothing here imports the
 * core, whose plugin and engine code is the server's (it reads files) and must stay out of the browser's bundle.
 */

/** The names of the plugin's fields: an entry's `values` hold them, and a site's own field of one of these names stands in its place. */
export const SEO_FIELDS = {
	preview: "seoPreview",
	title: "seoTitle",
	description: "seoDescription",
	image: "seoImage",
	noindex: "seoNoindex",
	canonical: "seoCanonical",
} as const;

/** About how many characters a search result shows before it cuts the line. The count turns to a warning past it; nothing is refused. */
export const SEO_LIMITS = { title: 60, description: 160 } as const;

/** The names of the inputs and the view its browser half brings (`@monti-cms/seo/admin`). */
export const SEO_INPUTS = { title: "seo.title", description: "seo.description", noindex: "seo.noindex" } as const;
export const SEO_PREVIEW = "seo.preview";

/** The site's own fields an empty SEO value falls back to. */
export type SeoFollows = {
	/** The field an empty description takes: `summary` unless said otherwise. */
	description?: string;
	/** The media field an empty share image takes: `cover` unless said otherwise. */
	image?: string;
};
export const SEO_FOLLOWS = { description: "summary", image: "cover" } as const;
