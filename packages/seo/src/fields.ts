import {
	createActiveTranslator,
	fields,
	type MediaField,
	type SelectField,
	type TextField,
	type ViewField,
} from "@monti-cms/core";
import { seoMessages } from "./messages";

/**
 * SEO field set (`seoFields`). Spread it into a collection's `fields`. Values are found by role (`SEO_ROLES`), not by field name, so field names and
 * labels are up to the site. Every field has a `tab` (default `SEO`), so they gather in that tab of the edit screen even without a `layout`.
 *
 * ```ts
 * fields: { title, slug, ...seoFields() }
 * ```
 */

/** Field slots of the set. */
export type SeoPart = "preview" | "title" | "description" | "image" | "noindex" | "canonical";

/** Field role for each slot. The public page helper (`seoOf`), search preview and AI features find values by these roles. */
export const SEO_ROLES = {
	title: "seoTitle",
	description: "seoDescription",
	image: "ogImage",
	noindex: "noindex",
	canonical: "canonical",
} as const;

/** Default field names. */
export const SEO_DEFAULT_KEYS = {
	preview: "seoPreview",
	title: "seoTitle",
	description: "seoDescription",
	image: "seoImage",
	noindex: "seoNoindex",
	canonical: "seoCanonical",
} as const;

// When the config file loads this module the display language is not known yet, so default labels are chosen when the text is read.
const t = createActiveTranslator(seoMessages);

/** Default labels (follow the display language). */
export const SEO_DEFAULT_LABELS = {
	get title() {
		return t("field.title");
	},
	get description() {
		return t("field.description");
	},
	get image() {
		return t("field.image");
	},
	get noindex() {
		return t("field.noindex");
	},
	get canonical() {
		return t("field.canonical");
	},
} as const;

/** Approximate length that is not truncated in search results (the standard used by Strapi, Yoast and others). Used for the character count and AI suggestion length. */
export const SEO_DEFAULT_LIMITS = { title: 60, description: 155 } as const;

/** Admin UI input names (registered by the SEO extension's admin side). If not registered, the default input is rendered. */
export const SEO_INPUTS = { title: "seo-title", description: "seo-description", noindex: "seo-noindex" } as const;
/** Name of the view field for the search result and share preview. */
export const SEO_PREVIEW_VIEW = "search";

export interface SeoFieldsOptions<
	K extends Partial<Record<SeoPart, string>> = Partial<Record<SeoPart, string>>,
	O extends SeoPart = SeoPart,
> {
	/** Rename fields. Names that already have stored values are kept as they are. */
	readonly keys?: K;
	/** Slots to omit (e.g. `["canonical"]`). */
	readonly omit?: readonly O[];
	/** Change labels. */
	readonly labels?: Partial<Record<Exclude<SeoPart, "preview">, string>> & { readonly preview?: string };
	/** Edit screen tab name. Default `SEO`. */
	readonly tab?: string;
	/** Keep title, description, image and canonical URL separate per language. Default `true` (hiding is always a shared value). */
	readonly localized?: boolean;
	/** Recommended lengths (the count changes color when exceeded; saving is not blocked). Also used for AI suggestion length. */
	readonly limits?: { readonly title?: number; readonly description?: number };
}

type KeyOf<K, P extends SeoPart> = K extends { readonly [Q in P]: infer N extends string }
	? N
	: (typeof SEO_DEFAULT_KEYS)[P];

/** Field definition shape for each slot (determines the stored value type). */
interface SeoPartFields {
	readonly preview: ViewField;
	readonly title: TextField;
	readonly description: TextField;
	readonly image: MediaField;
	readonly noindex: SelectField<"index" | "noindex">;
	readonly canonical: TextField;
}

/** Fields returned by `seoFields` (field name → definition). */
export type SeoFields<K, O extends SeoPart = never> = {
	readonly [P in Exclude<SeoPart, O> as KeyOf<K, P>]: SeoPartFields[P];
};

/** Builds the SEO field set. */
export function seoFields<
	const K extends Partial<Record<SeoPart, string>> = Record<never, never>,
	const O extends SeoPart = never,
>(options: SeoFieldsOptions<K, O> = {}): SeoFields<K, O> {
	const key = (part: SeoPart) => options.keys?.[part] ?? SEO_DEFAULT_KEYS[part];
	const custom = (part: Exclude<SeoPart, "preview">) => options.labels?.[part];
	/** If the site did not set a label, it is chosen by display language at read time (the language is not known yet when the field is built). */
	const lazyLabel = <F extends { label: string }>(field: F, part: Exclude<SeoPart, "preview">): F =>
		custom(part) === undefined
			? Object.defineProperty(field, "label", {
					get: () => SEO_DEFAULT_LABELS[part],
					enumerable: true,
					configurable: true,
				})
			: field;
	const tab = options.tab ?? "SEO";
	const localized = options.localized ?? true;
	const limits = { ...SEO_DEFAULT_LIMITS, ...options.limits };
	const shared = { tab, ...(localized ? { localized: true as const } : {}) };
	const result: Record<string, unknown> = {
		/** Search result and share preview. Values are read from the role fields, falling back to the title and summary when empty. */
		[key("preview")]: fields.view({
			view: SEO_PREVIEW_VIEW,
			tab,
			...(options.labels?.preview ? { label: options.labels.preview } : {}),
		}),
		/** Search result title. Falls back to the title when empty. */
		[key("title")]: lazyLabel(
			fields.text({
				label: custom("title") ?? "",
				role: SEO_ROLES.title,
				input: SEO_INPUTS.title,
				inputOptions: { limit: limits.title },
				...shared,
			}),
			"title",
		),
		/** Search result description. Falls back to the summary when empty. */
		[key("description")]: lazyLabel(
			fields.text({
				label: custom("description") ?? "",
				role: SEO_ROLES.description,
				multiline: true,
				input: SEO_INPUTS.description,
				inputOptions: { limit: limits.description },
				...shared,
			}),
			"description",
		),
		/** Link preview and search result image. Falls back to the site's default image when empty. */
		[key("image")]: lazyLabel(
			fields.media({ label: custom("image") ?? "", role: SEO_ROLES.image, accept: "image", ...shared }),
			"image",
		),
		/** Hidden from search engines when `noindex`. */
		[key("noindex")]: lazyLabel(
			fields.select({
				label: custom("noindex") ?? "",
				role: SEO_ROLES.noindex,
				options: {
					get index() {
						return t("option.index");
					},
					get noindex() {
						return t("option.noindex");
					},
				},
				defaultValue: "index",
				input: SEO_INPUTS.noindex,
				tab,
			}),
			"noindex",
		),
		/** URL of the post first published elsewhere (canonical). */
		[key("canonical")]: lazyLabel(
			fields.text({
				label: custom("canonical") ?? "",
				role: SEO_ROLES.canonical,
				placeholder: "https://",
				...shared,
			}),
			"canonical",
		),
	};
	for (const part of options.omit ?? []) delete result[key(part)];
	return result as unknown as SeoFields<K, O>;
}
