import { randomUUID } from "node:crypto";
import type { Cms } from "../../../cms";
import { replaceMismatch } from "../../../core/domain/media";
import { isImageType } from "../../../core/media-types";
import type { MediaAssetRecord } from "../../../core/store/types";
import { CmsError } from "../error-handler";
import { parseWith } from "../handler";
import {
	attachmentDisposition,
	extensionFor,
	extensionOf,
	inspectUploadedFile,
	sizeNotice,
	typeNames,
	UPLOAD_URL_TTL_SECONDS,
} from "./media-files";

/**
 * The two steps of a media upload, shared by the upload routes: `prepareMediaUpload` registers the
 * asset and issues the direct upload URL, `completeMediaUpload` inspects the stored file and makes the asset usable. Both throw `CmsError`.
 */

export interface PreparedMediaUpload {
	readonly mediaId: string;
	readonly uploadUrl: string;
	readonly method: "PUT";
	readonly requiredHeaders: Record<string, string>;
	readonly expiresAt: string;
	readonly original?: {
		readonly uploadUrl: string;
		readonly method: "PUT";
		readonly requiredHeaders: Record<string, string>;
		readonly expiresAt: string;
	};
}

/** What an upload answers once the asset is `ready`. */
function describeReadyMedia(cms: Cms, record: MediaAssetRecord) {
	return {
		mediaId: record.id,
		status: "ready",
		publicUrl: record.storageKey ? cms.mediaStore().getPublicUrl(record.storageKey) : null,
		width: record.width,
		height: record.height,
		byteSize: record.byteSize,
		mimeType: record.mimeType,
		defaultAlt: record.defaultAlt,
		defaultCaption: record.defaultCaption,
	};
}

/** The server decides the allowed type, size and file key. `raw` is the request body of `POST /media/uploads`. */
export async function prepareMediaUpload(cms: Cms, raw: unknown): Promise<PreparedMediaUpload> {
	const input = raw as { mimeType?: unknown; original?: { mimeType?: unknown } };
	// §10.1: a disallowed file type is 415 (distinct from the 400 format error).
	const allowed = [
		...cms.site.api.ALLOWED_IMAGE_MIME_TYPES,
		...cms.site.api.ALLOWED_FILE_MIME_TYPES,
	] as readonly unknown[];
	if (input?.mimeType !== undefined && !allowed.includes(input.mimeType)) {
		throw new CmsError(`Allowed types: ${allowed.join(", ")}`, "unsupported_media_type", {
			notice: { key: "media.upload.type", vars: { types: typeNames(allowed as readonly string[]) } },
		});
	}
	const originalMime = input?.original?.mimeType;
	if (
		originalMime !== undefined &&
		!(cms.site.api.ALLOWED_IMAGE_MIME_TYPES as readonly unknown[]).includes(originalMime)
	) {
		throw new CmsError(
			`Allowed image types: ${cms.site.api.ALLOWED_IMAGE_MIME_TYPES.join(", ")}`,
			"unsupported_media_type",
			{
				notice: {
					key: "media.upload.original_type",
					vars: { types: typeNames(cms.site.api.ALLOWED_IMAGE_MIME_TYPES) },
				},
			},
		);
	}
	const body = parseWith(cms.site.api.mediaUploadBodySchema, raw);
	const isFile = !isImageType(body.mimeType);
	// An attachment's type must match its filename extension. This stops type swaps such as sending a code file as text.
	if (isFile && cms.site.api.fileTypeFor(body.filename) !== body.mimeType) {
		const extension = extensionOf(body.filename);
		throw new CmsError(`File extension does not match ${body.mimeType}`, "unsupported_media_type", {
			notice: extension ? { key: "media.upload.extension", vars: { extension } } : { key: "media.upload.no_extension" },
		});
	}
	const originalFile = "original" in body ? body.original : undefined;
	const limit = isFile ? cms.site.api.MAX_FILE_BYTES : cms.site.api.MAX_MEDIA_BYTES;
	for (const file of [body, originalFile]) {
		if (file && file.byteSize > limit) {
			throw new CmsError(
				`File size exceeds the ${limit / 1024 / 1024}MiB limit (${file.byteSize} bytes)`,
				"payload_too_large",
				{ notice: sizeNotice(limit) },
			);
		}
	}

	const mediaId = randomUUID();
	const stagingKey = `staging/${mediaId}.${extensionFor(body.mimeType)}`;
	const originalStagingKey = originalFile ? `staging/${mediaId}-original.${extensionFor(originalFile.mimeType)}` : null;

	await cms.store().createMediaAsset({
		id: mediaId,
		filename: body.filename,
		mimeType: body.mimeType,
		byteSize: body.byteSize,
		stagingKey,
		...(body.folderId !== undefined ? { folderId: body.folderId } : {}),
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
		byteSize: body.byteSize,
		expiresInSeconds: UPLOAD_URL_TTL_SECONDS,
	});
	const original =
		originalFile && originalStagingKey
			? await mediaStore.prepareUpload({
					stagingKey: originalStagingKey,
					contentType: originalFile.mimeType,
					byteSize: originalFile.byteSize,
					expiresInSeconds: UPLOAD_URL_TTL_SECONDS,
				})
			: null;

	const describe = (upload: typeof presigned) => ({
		uploadUrl: upload.url,
		method: upload.method,
		requiredHeaders: upload.requiredHeaders,
		expiresAt: upload.expiresAt.toISOString(),
	});
	return { mediaId, ...describe(presigned), ...(original ? { original: describe(original) } : {}) };
}

/** Inspects the stored file by its bytes and promotes it. The asset is `ready` afterwards; a file that fails inspection leaves it `failed`. */
export async function completeMediaUpload(cms: Cms, mediaId: string) {
	const store = cms.store();
	const media = await store.getMediaAsset(mediaId);
	if (!media) throw new CmsError("Media asset not found", "not_found");

	const mediaStore = cms.mediaStore();
	if (media.status === "ready") return describeReadyMedia(cms, media);
	if (media.status !== "pending" || !media.stagingKey) {
		throw new CmsError(`Media asset cannot be completed in status: ${media.status}`, "upload_incomplete");
	}

	let file: Awaited<ReturnType<typeof inspectUploadedFile>>;
	let original: Awaited<ReturnType<typeof inspectUploadedFile>> | null = null;
	try {
		file = await inspectUploadedFile(
			cms.site,
			mediaStore,
			media.stagingKey,
			media.mimeType,
			media.byteSize ?? undefined,
		);
		if (media.original?.stagingKey)
			original = await inspectUploadedFile(
				cms.site,
				mediaStore,
				media.original.stagingKey,
				undefined,
				media.original.byteSize ?? undefined,
			);
	} catch (error) {
		// If the file is not there yet, leave it as is so it can be retried. A file that fails inspection cannot be used.
		if (!(error instanceof CmsError) || error.code !== "upload_incomplete") await store.failMediaAsset(mediaId);
		throw error;
	}

	const finalKey = `media/${mediaId}.${extensionFor(file.detected.mimeType)}`;
	await mediaStore.promoteFile({
		stagingKey: media.stagingKey,
		finalKey,
		expectedEtag: file.head.etag,
		contentType: file.detected.mimeType,
		// Attachments download under their original name. Images display directly in the browser.
		...(isImageType(file.detected.mimeType) ? {} : { contentDisposition: attachmentDisposition(media.filename) }),
	});
	let originalKey: string | null = null;
	if (original && media.original?.stagingKey) {
		originalKey = `media/${mediaId}-original.${extensionFor(original.detected.mimeType)}`;
		await mediaStore.promoteFile({
			stagingKey: media.original.stagingKey,
			finalKey: originalKey,
			expectedEtag: original.head.etag,
			contentType: original.detected.mimeType,
		});
	}

	const updated = await store.completeMediaAsset({
		id: mediaId,
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
						// The original is always an image, so it has dimensions.
						width: original.detected.width ?? 0,
						height: original.detected.height ?? 0,
					},
				}
			: {}),
	});
	return describeReadyMedia(cms, updated);
}

/**
 * Moves the stored file of the uploaded and completed asset `fromId` into the asset `id`, which keeps its id, name, folder, alt, caption and references. The kind
 * must match (see `replaceMismatch`). The files `id` gave up are deleted after the commit; a failed delete leaves a stray file but does not fail the call.
 */
export async function replaceMediaFile(cms: Cms, id: string, fromId: string) {
	if (id === fromId) throw new CmsError("A media file cannot replace itself", "invalid_input");
	const store = cms.store();
	const [target, source] = await Promise.all([store.getMediaAsset(id), store.getMediaAsset(fromId)]);
	if (!target || target.status !== "ready") throw new CmsError("Media asset not found", "not_found");
	if (!source || source.status !== "ready") throw new CmsError("Replacement media asset not found", "not_found");
	const mismatch = replaceMismatch(target.mimeType, source.mimeType);
	if (mismatch) {
		throw new CmsError("The replacement is not the same kind of file", "unsupported_media_type", {
			notice: { key: mismatch },
		});
	}
	const { media, released } = await store.replaceMediaFile({ id, fromId });
	await cms.mediaService().release(released);
	return describeReadyMedia(cms, media);
}
