import type { MediaItem } from "@monti-cms/core";

/** "2400×1600" of what the site shows; nothing for a file with no such size. */
export function sizeLabel(item: Pick<MediaItem, "original" | "web">): string {
	const { width, height } = item.web ?? item.original;
	return width && height ? `${width}×${height}` : "";
}

/** The address to show a file's picture from: the web size, so a page of tiles is not a page of originals. */
export const previewUrl = (item: Pick<MediaItem, "original" | "web">) => item.web?.url ?? item.original.url;
