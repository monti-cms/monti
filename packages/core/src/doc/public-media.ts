import type { ContentStore } from "../core/store";
import type { MediaStore } from "../media/store";
import type { ImageResolveResult } from "./image-src";

/** The stores the public media helpers read. They are looked up when used, so nothing connects until then. */
export interface PublicMediaDeps {
	readonly store: () => ContentStore;
	readonly mediaStore: () => MediaStore;
}

/**
 * Resolves registered media ids into public URLs, sizes and file info (a ready file) or the reason there is none. Ids with no media row are left out
 * (the resolvers read them as unresolved). A deployment without a database or storage resolves nothing and still renders.
 */
export async function resolvePublicMedia(
	deps: PublicMediaDeps,
	mediaIds: readonly string[],
): Promise<Map<string, ImageResolveResult>> {
	const urls = new Map<string, ImageResolveResult>();
	if (mediaIds.length === 0) return urls;
	try {
		const store = deps.store();
		const mediaStore = deps.mediaStore();
		await Promise.all(
			mediaIds.map(async (mediaId) => {
				const media = await store.getMediaAsset(mediaId);
				if (!media) return;
				if (media.status !== "ready") {
					urls.set(mediaId, { failure: "not-ready" });
					return;
				}
				if (!media.storageKey) {
					urls.set(mediaId, { failure: "unresolved" });
					return;
				}
				const url = mediaStore.getPublicUrl(media.storageKey);
				const { width, height } = media;
				const file = { filename: media.filename, byteSize: media.byteSize, mimeType: media.mimeType };
				urls.set(mediaId, width && height && width > 0 && height > 0 ? { url, width, height, file } : { url, file });
			}),
		);
	} catch {
		// Keystatic/public-only deployments may not configure the CMS database or R2.
		// Keep rendering and let CmsImage show its neutral fallback.
	}
	return urls;
}

/**
 * Public URL of one media item (shared image etc.). `null` if it is not ready or the deployment has no DB or storage.
 */
export async function resolvePublicMediaUrl(
	deps: PublicMediaDeps,
	mediaId: string,
): Promise<{ url: string; width?: number; height?: number } | null> {
	try {
		const media = await deps.store().getMediaAsset(mediaId);
		if (!media || media.status !== "ready" || !media.storageKey) return null;
		const url = deps.mediaStore().getPublicUrl(media.storageKey);
		return media.width && media.height ? { url, width: media.width, height: media.height } : { url };
	} catch {
		return null;
	}
}
