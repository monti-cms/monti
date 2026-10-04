import { getCmsContentStore, getCmsMediaStore } from "../container";

/**
 * 미디어 하나의 공개 주소(공유 이미지 등). 준비되지 않았거나 DB·저장소가 없는 배포면 `null`이다.
 */
export async function resolvePublicMediaUrl(
	mediaId: string,
): Promise<{ url: string; width?: number; height?: number } | null> {
	try {
		const media = await getCmsContentStore().getMediaAsset(mediaId);
		if (!media || media.status !== "ready" || !media.storageKey) return null;
		const url = getCmsMediaStore().getPublicUrl(media.storageKey);
		return media.width && media.height ? { url, width: media.width, height: media.height } : { url };
	} catch {
		return null;
	}
}
