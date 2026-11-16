/** A file's size as a person reads it: "2.1 MB", "340 KB". No bytes: anything under a kilobyte reads "1 KB". */
export function bytes(size: number): string {
	const megabyte = 1024 * 1024;
	if (size >= megabyte) return `${(size / megabyte).toFixed(1)} MB`;
	return `${Math.max(1, Math.round(size / 1024))} KB`;
}
