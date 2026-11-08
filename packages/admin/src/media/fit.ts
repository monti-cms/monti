/** A picture's size with its longest side at most `limit`, in whole pixels. A smaller picture stays as it is. */
export function fitLongSide(width: number, height: number, limit: number) {
	const longest = Math.max(width, height);
	if (longest <= limit) return { width, height };
	const scale = limit / longest;
	return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/**
 * How much to scale a picture of `size` bytes first to come under `limit`: the bytes of a compressed picture follow its area, so the side follows the root. A little
 * under, because compression is not exact.
 */
export const firstShrink = (size: number, limit: number) => Math.min(1, Math.sqrt(limit / size) * 0.9);
