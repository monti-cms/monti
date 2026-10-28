import type { Site } from "@monti-cms/core/site";
import { useSyncExternalStore } from "react";
import { prepareUpload, type UploadedMedia, uploadImageFile } from "./upload-helper";

/**
 * The one place the editor starts the upload of an image. It prepares the file and sends it, reporting how far it is. The upload rules (WebP for every picture, the location data removed) belong to `upload-helper.ts`, shared with the media library; a change to them is made there, and this function is where the editor calls it.
 */
export async function uploadEditorImage(
	site: Site,
	file: File,
	onProgress?: (percent: number) => void,
	options?: { folderId?: string | null },
): Promise<UploadedMedia> {
	const prepared = await prepareUpload(site, file);
	return uploadImageFile(site, prepared, onProgress, options);
}

/** An image that is going up: the local picture of the file and how far it is. */
export interface ImageUpload {
	readonly preview: string | null;
	readonly percent: number;
}

const uploads = new Map<string, ImageUpload>();
const listeners = new Set<() => void>();
const notify = () => {
	for (const listener of listeners) listener();
};
const subscribe = (listener: () => void) => {
	listeners.add(listener);
	return () => listeners.delete(listener);
};

/** An upload starts: shows the file's own picture until the real image is there. */
export function beginImageUpload(id: string, file: File): void {
	const preview = typeof URL.createObjectURL === "function" ? URL.createObjectURL(file) : null;
	uploads.set(id, { preview, percent: 0 });
	notify();
}

export function setImageUploadPercent(id: string, percent: number): void {
	const current = uploads.get(id);
	if (!current) return;
	uploads.set(id, { ...current, percent });
	notify();
}

/** The upload is over, done or failed. */
export function endImageUpload(id: string): void {
	const current = uploads.get(id);
	if (!current) return;
	if (current.preview && typeof URL.revokeObjectURL === "function") URL.revokeObjectURL(current.preview);
	uploads.delete(id);
	notify();
}

/** The upload with this id, or `null` once it is over. */
export function useImageUpload(id: string | null | undefined): ImageUpload | null {
	return useSyncExternalStore(
		subscribe,
		() => (id ? (uploads.get(id) ?? null) : null),
		() => null,
	);
}
