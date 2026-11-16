// How a file is worded wherever it is named: the admin's library and editor, the site's file link. One rule, in a module with no imports, so the admin's
// client and the site's server both take it without pulling in anything of the core's server.

/** "PDF": what a file is, from its name (the part after its last dot, upper case); nothing for a name with no extension. */
export const fileKind = (name: string): string => {
	const dot = name.lastIndexOf(".");
	return dot > 0 ? name.slice(dot + 1).toUpperCase() : "";
};

/** A file's size as a person reads it: "2.1 MB", "340 KB". No bytes: anything under a kilobyte reads "1 KB". */
export function fileSize(size: number): string {
	const megabyte = 1024 * 1024;
	if (size >= megabyte) return `${(size / megabyte).toFixed(1)} MB`;
	return `${Math.max(1, Math.round(size / 1024))} KB`;
}

/** What a file link adds to its name: the kind and the size, `PDF · 121 KB`; the kind alone for a file with no size, nothing for one that says neither. */
export function fileMeta(file: { name: string; size?: number }): string {
	return [fileKind(file.name), typeof file.size === "number" && file.size > 0 ? fileSize(file.size) : ""]
		.filter(Boolean)
		.join(" · ");
}
