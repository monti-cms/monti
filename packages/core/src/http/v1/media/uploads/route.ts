import { randomUUID } from "node:crypto";
import { getCmsContentStore, getCmsMediaStore } from "../../../../container";
import {
	ALLOWED_FILE_MIME_TYPES,
	ALLOWED_IMAGE_MIME_TYPES,
	fileTypeFor,
	isImageMime,
	MAX_FILE_BYTES,
	MAX_MEDIA_BYTES,
	mediaUploadBodySchema,
} from "../../../../core/api";
import { HttpError } from "../../error-handler";
import { adminRoute, json, parseWith, readJsonBody } from "../../handler";
import { extensionFor, UPLOAD_URL_TTL_SECONDS } from "../media-files";

/**
 * 업로드 준비(§7.2). 서버가 허용 형식·크기와 파일 키를 정하고 제한된 시간의 직접 업로드 URL을 준다.
 * 자격 증명은 브라우저에 가지 않고 파일 본문은 앱 서버를 거치지 않는다.
 */
export const POST = adminRoute(async ({ request }) => {
	const raw = (await readJsonBody(request)) as { mimeType?: unknown; original?: { mimeType?: unknown } };
	// §10.1: 허용하지 않는 파일 형식은 415다(형식 오류 400과 구분한다).
	const allowed = [...ALLOWED_IMAGE_MIME_TYPES, ...ALLOWED_FILE_MIME_TYPES] as readonly unknown[];
	if (raw?.mimeType !== undefined && !allowed.includes(raw.mimeType)) {
		throw new HttpError(415, "unsupported_media_type", `Allowed types: ${allowed.join(", ")}`);
	}
	const originalMime = raw?.original?.mimeType;
	if (originalMime !== undefined && !(ALLOWED_IMAGE_MIME_TYPES as readonly unknown[]).includes(originalMime)) {
		throw new HttpError(415, "unsupported_media_type", `Allowed image types: ${ALLOWED_IMAGE_MIME_TYPES.join(", ")}`);
	}
	const body = parseWith(mediaUploadBodySchema, raw);
	const isFile = !isImageMime(body.mimeType);
	// 첨부 파일의 형식은 이름의 확장자와 맞아야 한다. 코드 파일을 글자로 보내는 식의 형식 바꿔치기를 막는다.
	if (isFile && fileTypeFor(body.filename) !== body.mimeType) {
		throw new HttpError(415, "unsupported_media_type", `File extension does not match ${body.mimeType}`);
	}
	const originalFile = "original" in body ? body.original : undefined;
	const limit = isFile ? MAX_FILE_BYTES : MAX_MEDIA_BYTES;
	for (const file of [body, originalFile]) {
		if (file && file.byteSize > limit) {
			throw new HttpError(
				413,
				"payload_too_large",
				`File size exceeds the ${limit / 1024 / 1024}MiB limit (${file.byteSize} bytes)`,
			);
		}
	}

	const mediaId = randomUUID();
	const stagingKey = `staging/${mediaId}/${randomUUID()}.${extensionFor(body.mimeType)}`;
	const originalStagingKey = originalFile
		? `staging/${mediaId}/original-${randomUUID()}.${extensionFor(originalFile.mimeType)}`
		: null;

	await getCmsContentStore().createMediaAsset({
		id: mediaId,
		filename: body.filename,
		mimeType: body.mimeType,
		byteSize: body.byteSize,
		stagingKey,
		...(originalFile && originalStagingKey
			? {
					original: {
						mimeType: originalFile.mimeType,
						byteSize: originalFile.byteSize,
						stagingKey: originalStagingKey,
					},
				}
			: {}),
	});

	const mediaStore = getCmsMediaStore();
	const presigned = await mediaStore.prepareUpload({
		stagingKey,
		contentType: body.mimeType,
		expiresInSeconds: UPLOAD_URL_TTL_SECONDS,
	});
	const original =
		originalFile && originalStagingKey
			? await mediaStore.prepareUpload({
					stagingKey: originalStagingKey,
					contentType: originalFile.mimeType,
					expiresInSeconds: UPLOAD_URL_TTL_SECONDS,
				})
			: null;

	const describe = (upload: typeof presigned) => ({
		uploadUrl: upload.url,
		method: upload.method,
		requiredHeaders: upload.requiredHeaders,
		expiresAt: upload.expiresAt.toISOString(),
	});
	return json(
		{ mediaId, ...describe(presigned), ...(original ? { original: describe(original) } : {}) },
		{ status: 201 },
	);
});
