/**
 * Utility to convert title into clean URL-friendly slug.
 * Preserves Korean NFC characters, replaces spaces/underscores with hyphens,
 * and collapses multiple hyphens.
 */
export declare function slugify(text: string): string;
export declare const MAX_SLUG_LENGTH = 200;
export type SlugInputError = "invalid_slug_format" | "slug_too_long";
/**
 * Slug normalization for storage. Applies NFC and trims surrounding whitespace; an empty result is `null` (a draft without a slug).
 * Rejects `/`, `?`, `#` and control characters; length is counted in code points.
 */
export declare function normalizeSlugInput(raw: string | null | undefined): {
    slug: string | null;
} | {
    error: SlugInputError;
};
