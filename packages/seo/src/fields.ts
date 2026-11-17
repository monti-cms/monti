import { definePlugin, type Plugin, type PluginField } from "@monti-cms/core";
import { type SeoLanguage, seoWords } from "./messages";
import { SEO_FIELDS, SEO_FOLLOWS, SEO_INPUTS, SEO_LIMITS, SEO_PREVIEW, type SeoFollows } from "./names";

export type SeoOptions = {
	/** The document collections that get the fields; every document collection when left out. */
	collections?: readonly string[];
	/** The language of the fields' names in the admin: Korean unless said otherwise, as the admin is. */
	language?: SeoLanguage;
	/** Recommended lengths, for the counts. */
	limits?: { title?: number; description?: number };
	follows?: SeoFollows;
};

/**
 * The SEO plugin (doc 14): a tab of search and share fields on every document collection, their preview in the editor, a search title and
 * a share image column for the lists. The site's pages read the values with `seoOf`.
 *
 * ```ts
 * // monti.config.ts
 * plugins: [seo()]
 * // app/admin/page.tsx
 * <AdminPage plugins={[seoAdmin]} />
 * ```
 */
export function seo(options: SeoOptions = {}): Plugin {
	const words = seoWords[options.language ?? "ko"];
	const limits = { ...SEO_LIMITS, ...options.limits };
	const follows = { ...SEO_FOLLOWS, ...options.follows };
	const fields: Record<string, PluginField> = {
		[SEO_FIELDS.preview]: { kind: "view", view: SEO_PREVIEW, options: { follows } },
		[SEO_FIELDS.title]: {
			kind: "text",
			locale: "perLocale",
			label: words.title,
			description: `The page's title in search results and shared links, about ${limits.title} characters. Empty, the entry's title is used.`,
			input: SEO_INPUTS.title,
			inputOptions: { limit: limits.title },
		},
		[SEO_FIELDS.description]: {
			kind: "text",
			multiline: true,
			locale: "perLocale",
			label: words.description,
			description: `One or two sentences under the title in search results, about ${limits.description} characters. Empty, the ${follows.description} field is used.`,
			input: SEO_INPUTS.description,
			inputOptions: { limit: limits.description, follows: follows.description },
		},
		[SEO_FIELDS.image]: {
			kind: "media",
			accept: "image",
			label: words.image,
			description: `The picture a shared link shows. Empty, the ${follows.image} field is used.`,
		},
		[SEO_FIELDS.noindex]: {
			kind: "select",
			options: ["noindex"],
			label: words.noindex,
			optionLabels: { noindex: words.hidden },
			description: "Set to noindex to keep the page out of search engines. Leave empty otherwise.",
			input: SEO_INPUTS.noindex,
		},
		[SEO_FIELDS.canonical]: {
			kind: "text",
			// A translation repeats its own original, not its source's.
			locale: "perLocale",
			label: words.canonical,
			description: "The address of the page this one repeats, when it was first published elsewhere. Usually empty.",
		},
	};
	return definePlugin({
		name: "seo",
		label: "SEO",
		fields: [
			{
				tab: words.tab,
				...(options.collections ? { collections: options.collections } : {}),
				fields,
				columns: [SEO_FIELDS.title, SEO_FIELDS.description, SEO_FIELDS.image],
			},
		],
	});
}
