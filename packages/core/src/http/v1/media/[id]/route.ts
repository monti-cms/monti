import { getCmsContentStore, getCmsMediaStore } from "../../../../container";
import { mediaPatchBodySchema } from "../../../../core/api";
import { HttpError } from "../../error-handler";
import { adminRoute, json, parseWith, readJsonBody } from "../../handler";

type IdParams = { id: string };

/** 미디어 상세. 편집기가 `mediaId`만으로 이미지를 보여줄 때도 쓴다(저장 실물 확인 포함). */
export const GET = adminRoute<IdParams>(async ({ params }) => {
	const media = await getCmsContentStore().getMediaAsset(params.id);
	if (!media) throw new HttpError(404, "not_found", "Media asset not found");
	if (media.status !== "ready" || !media.storageKey) {
		return json({ ...media, mediaId: media.id, publicUrl: null });
	}
	const mediaStore = getCmsMediaStore();
	const head = await mediaStore.headFile({ key: media.storageKey });
	return json({
		...media,
		mediaId: media.id,
		status: head ? "ready" : "missing",
		publicUrl: head ? mediaStore.getPublicUrl(media.storageKey) : null,
		originalUrl: media.original?.storageKey ? mediaStore.getPublicUrl(media.original.storageKey) : null,
	});
});

/** 기본 alt·caption 수정. 이미 작성한 본문은 바뀌지 않는다(§7.3). */
export const PATCH = adminRoute<IdParams>(async ({ request, params }) => {
	const body = parseWith(mediaPatchBodySchema, await readJsonBody(request));
	return json(await getCmsContentStore().updateMediaMetadata({ id: params.id, ...body }));
});

/**
 * 사용하지 않는 파일만 삭제한다(§7.3). `deleting`으로 바꾼 뒤 파일을 지우고, 성공하면 행을 제거한다.
 * 저장소 삭제가 실패하면 `deleting` 행이 남아 다시 시도할 수 있다.
 */
export const DELETE = adminRoute<IdParams>(async ({ params }) => {
	const store = getCmsContentStore();
	const media = await store.beginMediaDelete(params.id);
	const mediaStore = getCmsMediaStore();
	const keys = [media.storageKey, media.stagingKey, media.original?.storageKey, media.original?.stagingKey];
	for (const key of keys) {
		if (key) await mediaStore.deleteFile({ key });
	}
	await store.finalizeMediaDelete(params.id);
	return json({ success: true, id: params.id });
});
