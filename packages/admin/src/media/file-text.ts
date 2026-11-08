import type { MediaItem } from "@monti-cms/core";

/** "2.1 MB", "340 KB": a file's size as a person reads it. */
export function formatBytes(bytes: number): string {
	if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, "")} MB`;
	if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
	return `${bytes} B`;
}

/** "PDF": what a file's preview says it is, from its name. */
export const extensionLabel = (name: string) => {
	const dot = name.lastIndexOf(".");
	return dot > 0 ? name.slice(dot + 1).toUpperCase() : "";
};

/** "2400×1600" of what the site shows; nothing for a file with no such size. */
export function sizeLabel(item: Pick<MediaItem, "original" | "web">): string {
	const { width, height } = item.web ?? item.original;
	return width && height ? `${width}×${height}` : "";
}

/** The address to show a file's picture from: the web size, so a page of tiles is not a page of originals. */
export const previewUrl = (item: Pick<MediaItem, "original" | "web">) => item.web?.url ?? item.original.url;
