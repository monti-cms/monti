/**
 * Utility to convert title into clean URL-friendly slug.
 * Preserves Korean NFC characters, replaces spaces/underscores with hyphens,
 * and collapses multiple hyphens.
 */
export function slugify(text) {
    if (!text)
        return "";
    return text
        .normalize("NFC")
        .trim()
        .toLowerCase()
        .replace(/[\s_]+/g, "-") // replace spaces and underscores with -
        .replace(/[^\p{L}\p{N}-]+/gu, "") // remove all non-alphanumeric/non-letter chars except hyphen
        .replace(/--+/g, "-") // collapse multiple hyphens
        .replace(/^-+|-+$/g, ""); // trim leading/trailing hyphens
}
export const MAX_SLUG_LENGTH = 200;
/**
 * Slug normalization for storage. Applies NFC and trims surrounding whitespace; an empty result is `null` (a draft without a slug).
 * Rejects `/`, `?`, `#` and control characters; length is counted in code points.
 */
export function normalizeSlugInput(raw) {
    const slug = raw ? raw.trim().normalize("NFC") : "";
    if (!slug)
        return { slug: null };
    for (const char of slug) {
        const code = char.codePointAt(0) ?? 0;
        if (code < 0x20 || code === 0x7f || char === "/" || char === "?" || char === "#") {
            return { error: "invalid_slug_format" };
        }
    }
    if (Array.from(slug).length > MAX_SLUG_LENGTH)
        return { error: "slug_too_long" };
    return { slug };
}
