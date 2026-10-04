import { randomUUID } from "node:crypto";
import { getCmsContentStore, getCmsMediaStore } from "../../../../../container";
import { isImageMime } from "../../../../../core/api";
import { HttpError } from "../../../error-handler";
import { adminRoute, json } from "../../../handler";
import { attachmentDisposition, extensionFor, inspectUploadedFile } from "../../media-files";

/**
 * 업로드 완료 확인(§7.2). 저장된 파일을 서버가 검사한 뒤에만 `ready`로 확정한다.
 * 확인에 실패하면 미디어는 사용 가능 상태가 되지 않고 `failed`로 남아 정리 대상이 된다.
 */
export const POST = adminRoute<{ id: string }>(async ({ params }) => {
	const store = getCmsContentStore();
	const media = await store.getMediaAsset(params.id);
	if (!media) throw new HttpError(404, "not_found", "Media asset not found");

	const mediaStore = getCmsMediaStore();
	const describe = (record: NonNullable<typeof media>) => ({
		mediaId: record.id,
		status: "ready",
		publicUrl: record.storageKey ? mediaStore.getPublicUrl(record.storageKey) : null,
		width: record.width,
		height: record.height,
		byteSize: record.byteSize,
		mimeType: record.mimeType,
		defaultAlt: record.defaultAlt,
		defaultCaption: record.defaultCaption,
	});

	if (media.status === "ready") return json(describe(media));
	if (media.status !== "pending" || !media.stagingKey) {
		throw new HttpError(409, "upload_incomplete", `Media asset cannot be completed in status: ${media.status}`);
	}

	let file: Awaited<ReturnType<typeof inspectUploadedFile>>;
	let original: Awaited<ReturnType<typeof inspectUploadedFile>> | null = null;
	try {
		file = await inspectUploadedFile(mediaStore, media.stagingKey, media.mimeType);
		if (media.original?.stagingKey) original = await inspectUploadedFile(mediaStore, media.original.stagingKey);
	} catch (error) {
		// 파일이 아직 없으면 재시도할 수 있게 그대로 둔다. 검사에 실패한 파일은 사용할 수 없다.
		if (!(error instanceof HttpError) || error.code !== "upload_incomplete") await store.failMediaAsset(params.id);
		throw error;
	}

	const finalKey = `media/${params.id}/${randomUUID()}.${extensionFor(file.detected.mimeType)}`;
	await mediaStore.promoteFile({
		stagingKey: media.stagingKey,
		finalKey,
		expectedEtag: file.head.etag,
		contentType: file.detected.mimeType,
		// 첨부 파일은 원래 이름으로 내려받는다. 이미지는 브라우저에서 바로 보인다.
		...(isImageMime(file.detected.mimeType) ? {} : { contentDisposition: attachmentDisposition(media.filename) }),
	});
	let originalKey: string | null = null;
	if (original && media.original?.stagingKey) {
		originalKey = `media/${params.id}/original-${randomUUID()}.${extensionFor(original.detected.mimeType)}`;
		await mediaStore.promoteFile({
			stagingKey: media.original.stagingKey,
			finalKey: originalKey,
			expectedEtag: original.head.etag,
			contentType: original.detected.mimeType,
		});
	}

	const updated = await store.completeMediaAsset({
		id: params.id,
		storageKey: finalKey,
		mimeType: file.detected.mimeType,
		byteSize: file.head.contentLength,
		width: file.detected.width,
		height: file.detected.height,
		...(original && originalKey
			? {
					original: {
						storageKey: originalKey,
						mimeType: original.detected.mimeType,
						byteSize: original.head.contentLength,
						// 원본은 늘 이미지라 크기가 있다.
						width: original.detected.width ?? 0,
						height: original.detected.height ?? 0,
					},
				}
			: {}),
	});
	return json(describe(updated));
});
