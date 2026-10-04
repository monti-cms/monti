import { type MediaField, type SelectField, type TextField, type ViewField } from "@monti-cms/core";
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
export declare const SEO_ROLES: {
    readonly title: "seoTitle";
    readonly description: "seoDescription";
    readonly image: "ogImage";
    readonly noindex: "noindex";
    readonly canonical: "canonical";
};
/** Default field names. */
export declare const SEO_DEFAULT_KEYS: {
    readonly preview: "seoPreview";
    readonly title: "seoTitle";
    readonly description: "seoDescription";
    readonly image: "seoImage";
    readonly noindex: "seoNoindex";
    readonly canonical: "seoCanonical";
};
/** Default labels (follow the display language). */
export declare const SEO_DEFAULT_LABELS: {
    readonly title: string;
    readonly description: string;
    readonly image: string;
    readonly noindex: string;
    readonly canonical: string;
};
/** Approximate length that is not truncated in search results (the standard used by Strapi, Yoast and others). Used for the character count and AI suggestion length. */
export declare const SEO_DEFAULT_LIMITS: {
    readonly title: 60;
    readonly description: 155;
};
/** Admin UI input names (registered by the SEO extension's admin side). If not registered, the default input is rendered. */
export declare const SEO_INPUTS: {
    readonly title: "seo-title";
    readonly description: "seo-description";
    readonly noindex: "seo-noindex";
};
/** Name of the view field for the search result and share preview. */
export declare const SEO_PREVIEW_VIEW = "search";
export interface SeoFieldsOptions<K extends Partial<Record<SeoPart, string>> = Partial<Record<SeoPart, string>>, O extends SeoPart = SeoPart> {
    /** Rename fields. Names that already have stored values are kept as they are. */
    readonly keys?: K;
    /** Slots to omit (e.g. `["canonical"]`). */
    readonly omit?: readonly O[];
    /** Change labels. */
    readonly labels?: Partial<Record<Exclude<SeoPart, "preview">, string>> & {
        readonly preview?: string;
    };
    /** Edit screen tab name. Default `SEO`. */
    readonly tab?: string;
    /** Keep title, description, image and canonical URL separate per language. Default `true` (hiding is always a shared value). */
    readonly localized?: boolean;
    /** Recommended lengths (the count changes color when exceeded; saving is not blocked). Also used for AI suggestion length. */
    readonly limits?: {
        readonly title?: number;
        readonly description?: number;
    };
}
type KeyOf<K, P extends SeoPart> = K extends {
    readonly [Q in P]: infer N extends string;
} ? N : (typeof SEO_DEFAULT_KEYS)[P];
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
export declare function seoFields<const K extends Partial<Record<SeoPart, string>> = Record<never, never>, const O extends SeoPart = never>(options?: SeoFieldsOptions<K, O>): SeoFields<K, O>;
export {};
