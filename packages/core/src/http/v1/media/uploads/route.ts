import { randomUUID } from "node:crypto";
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
 * Upload preparation. The server decides the allowed type, size, and file key, and issues a time-limited direct upload URL.
 * Credentials never reach the browser, and the file body does not pass through the app server.
 */
export const POST = adminRoute(async ({ request, cms }) => {
	const raw = (await readJsonBody(request)) as { mimeType?: unknown; original?: { mimeType?: unknown } };
	// §10.1: a disallowed file type is 415 (distinct from the 400 format error).
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
	// An attachment's type must match its filename extension. This stops type swaps such as sending a code file as text.
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

	await cms.store().createMediaAsset({
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

	const mediaStore = cms.mediaStore();
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
