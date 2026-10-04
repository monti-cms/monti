/**
 * Utility to convert title into clean URL-friendly slug.
 * Preserves Korean NFC characters, replaces spaces/underscores with hyphens,
 * and collapses multiple hyphens.
 */
export function slugify(text: string): string {
	if (!text) return "";
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

export type SlugInputError = "invalid_slug_format" | "slug_too_long";

/**
 * §6.2 저장용 slug 정규화. NFC·앞뒤 공백 제거 후 빈 값은 `null`(slug 없는 초안)이다.
 * `/`, `?`, `#`, 제어문자는 거부하고 길이는 코드 포인트로 센다.
 */
export function normalizeSlugInput(
	raw: string | null | undefined,
): { slug: string | null } | { error: SlugInputError } {
	const slug = raw ? raw.trim().normalize("NFC") : "";
	if (!slug) return { slug: null };
	for (const char of slug) {
		const code = char.codePointAt(0) ?? 0;
		if (code < 0x20 || code === 0x7f || char === "/" || char === "?" || char === "#") {
			return { error: "invalid_slug_format" };
		}
	}
	if (Array.from(slug).length > MAX_SLUG_LENGTH) return { error: "slug_too_long" };
	return { slug };
}
