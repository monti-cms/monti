/** A picture's size with its longest side at most `limit`, in whole pixels. A smaller picture stays as it is. */
export function fitLongSide(width: number, height: number, limit: number) {
	const longest = Math.max(width, height);
	if (longest <= limit) return { width, height };
	const scale = limit / longest;
	return { width: Math.round(width * scale), height: Math.round(height * scale) };
}
