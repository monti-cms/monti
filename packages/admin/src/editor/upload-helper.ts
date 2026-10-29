import type { Site } from "@monti-cms/core/site";
import { NoticeError } from "../api/client";
import { apiErrorMessages } from "../api/error-message.messages";
import { completeUpload, requestUpload, type UploadTicket } from "../api/media";
import { isSandboxSite } from "../screens/shared/preview-sandbox";
import { editorMessages } from "./messages";
import { readBytes, stripLocation } from "./strip-location";

/**
 * Browser image upload. Shared by the editor and the media library.
 *
 * 1. Web optimization, always: converts static JPEG, PNG, and WebP to WebP with the long edge at most 2560px. The original is kept as part of the same media.
 *    Location data (GPS) never leaves the browser: the converted file has none, and the kept original and a file that skips conversion lose their GPS
 *    tags without being re-encoded (`stripLocation`).
 * 2. Asks the server to prepare the upload and uploads directly to storage with the returned URL (the file does not pass through the app server).
 * 3. Requests completion confirmation. The server marks it `ready` only after inspecting the actual bytes.
 */

export interface OptimizePolicy {
	/** Formats to convert. Animated GIF and WebP, and formats with uncertain support, keep the original. */
	readonly formats: readonly string[];
	readonly maxEdge: number;
	readonly quality: number;
	readonly outputType: "image/webp";
	/** Name of the converted file. */
	readonly rename: (name: string) => string;
}

/** Default optimization policy. Can be changed in code. */
export const DEFAULT_OPTIMIZE_POLICY: OptimizePolicy = {
	formats: ["image/jpeg", "image/png", "image/webp"],
	maxEdge: 2560,
	quality: 0.9,
	outputType: "image/webp",
	rename: (name) => `${name.replace(/\.[^.]+$/, "") || "image"}.webp`,
};

/** `accept` value of an image file input: the image types this site allows. */
export const imageAccept = (site: Site) => site.api.ALLOWED_IMAGE_MIME_TYPES.join(",");

export interface PreparedUpload {
	/** File to upload for public use. The original as is if not optimized. */
	file: File;
	/** The original file, when optimized. */
	original?: File;
	optimized: boolean;
	/** Why optimization was skipped (for user-facing messages). */
	skippedReason?: string;
	width?: number;
	height?: number;
}

/** Whether the WebP has an animation chunk (`ANIM`). */
async function isAnimatedWebp(file: File): Promise<boolean> {
	const head = new Uint8Array(await readBytes(file.slice(0, 64 * 1024)));
	for (let i = 12; i < head.length - 4; i++) {
		if (head[i] === 0x41 && head[i + 1] === 0x4e && head[i + 2] === 0x49 && head[i + 3] === 0x4d) return true;
	}
	return false;
}

/** Draws the bitmap at the long edge `maxEdge` (never larger than it is) and encodes it. `null` when the browser cannot encode the type. */
async function encodeBitmap(
	bitmap: ImageBitmap,
	policy: OptimizePolicy,
	maxEdge: number,
	quality: number,
): Promise<{ blob: Blob; width: number; height: number; scale: number } | null> {
	const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
	const width = Math.round(bitmap.width * scale);
	const height = Math.round(bitmap.height * scale);
	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	canvas.getContext("2d")?.drawImage(bitmap, 0, 0, width, height);
	const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, policy.outputType, quality));
	// Browsers that do not support WebP encoding return PNG.
	return blob && blob.type === policy.outputType ? { blob, width, height, scale } : null;
}

/** The file as it goes up when it is not converted: with its location data removed. */
async function keepAsIs(
	file: File,
	skippedReason: string,
	size?: { width: number; height: number },
): Promise<PreparedUpload> {
	return { file: await stripLocation(file), optimized: false, skippedReason, ...size };
}

/**
 * Web optimization, on for every image. If it cannot convert or conversion is not a gain, the original goes up as it is and the reason is recorded.
 * Never silently turns an animation into a still image. Either way the location data is gone: a converted file is drawn again and has none, and a
 * file that is kept (the original beside a converted file too) loses only its GPS tags.
 */
export async function prepareUpload(
	site: Site,
	file: File,
	options: { policy?: OptimizePolicy } = {},
): Promise<PreparedUpload> {
	const t = site.createTranslator(editorMessages);
	const policy = options.policy ?? DEFAULT_OPTIMIZE_POLICY;
	if (!policy.formats.includes(file.type)) return keepAsIs(file, t("upload.keepFormat"));
	// Converting to a type the site does not allow would be refused by the server: keep the original instead.
	if (!site.api.isAllowedImage(policy.outputType)) return keepAsIs(file, t("upload.outputNotAllowed"));
	if (file.type === "image/webp" && (await isAnimatedWebp(file))) return keepAsIs(file, t("upload.keepAnimated"));
	if (typeof createImageBitmap !== "function" || typeof document === "undefined")
		return keepAsIs(file, t("upload.noConvert"));

	let bitmap: ImageBitmap;
	try {
		bitmap = await createImageBitmap(file);
	} catch {
		return keepAsIs(file, t("upload.unreadable"));
	}
	const encoded = await encodeBitmap(bitmap, policy, policy.maxEdge, policy.quality);
	bitmap.close();
	if (!encoded) return keepAsIs(file, t("upload.noWebp"));
	const { blob, width, height, scale } = encoded;
	if (scale === 1 && blob.size >= file.size) return keepAsIs(file, t("upload.originalSmaller"), { width, height });
	return {
		file: await stripLocation(new File([blob], policy.rename(file.name), { type: policy.outputType })),
		original: await stripLocation(file),
		optimized: true,
		width,
		height,
	};
}

/** Smaller and smaller versions to try for a picture that is too large: the long edge and the quality. */
const SHRINK_STEPS: readonly { maxEdge: number; quality: number }[] = [
	{ maxEdge: 2560, quality: 0.85 },
	{ maxEdge: 1920, quality: 0.8 },
	{ maxEdge: 1600, quality: 0.75 },
	{ maxEdge: 1280, quality: 0.7 },
	{ maxEdge: 1024, quality: 0.65 },
];

/**
 * The retry of a picture over the size limit: only a smaller WebP goes up (the original is not kept, since it is the original that was too large), the
 * first size that fits. `null` when the browser cannot make one or even the smallest does not fit.
 */
export async function shrinkForUpload(
	site: Site,
	file: File,
	policy: OptimizePolicy = DEFAULT_OPTIMIZE_POLICY,
): Promise<PreparedUpload | null> {
	if (!site.api.isAllowedImage(policy.outputType) || typeof createImageBitmap !== "function") return null;
	let bitmap: ImageBitmap;
	try {
		bitmap = await createImageBitmap(file);
	} catch {
		return null;
	}
	try {
		for (const step of SHRINK_STEPS) {
			const encoded = await encodeBitmap(bitmap, policy, step.maxEdge, step.quality);
			if (!encoded) return null;
			if (encoded.blob.size <= site.api.MAX_MEDIA_BYTES) {
				return {
					file: await stripLocation(new File([encoded.blob], policy.rename(file.name), { type: policy.outputType })),
					optimized: true,
					width: encoded.width,
					height: encoded.height,
				};
			}
		}
		return null;
	} finally {
		bitmap.close();
	}
}

function putFile(site: Site, ticket: UploadTicket, file: File, onProgress?: (loaded: number) => void): Promise<void> {
	const t = site.createTranslator(editorMessages);
	return new Promise<void>((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		xhr.open("PUT", ticket.uploadUrl, true);
		for (const [key, value] of Object.entries(ticket.requiredHeaders ?? {})) xhr.setRequestHeader(key, value);
		xhr.upload.onprogress = (event) => {
			if (event.lengthComputable) onProgress?.(event.loaded);
		};
		xhr.onload = () =>
			xhr.status >= 200 && xhr.status < 300
				? resolve()
				: reject(new Error(t("upload.storageFailed", { status: xhr.status })));
		xhr.onerror = () => reject(new Error(t("upload.networkError")));
		xhr.ontimeout = () => reject(new Error(t("upload.timeout")));
		xhr.send(file);
	});
}

/** Runs an admin API call of an upload step: a refused or failed call keeps its message, and being offline reads as the upload's network error. */
async function uploadCall<T>(site: Site, call: () => Promise<T>): Promise<T> {
	try {
		return await call();
	} catch (error) {
		if (error instanceof TypeError) throw new NoticeError(site.createTranslator(editorMessages)("upload.networkError"));
		throw error;
	}
}

export interface UploadedMedia {
	mediaId: string;
	publicUrl: string | null;
	width: number;
	height: number;
	defaultAlt: string;
	defaultCaption: string;
}

export async function uploadImageFile(
	site: Site,
	input: File | PreparedUpload,
	onProgress?: (percent: number) => void,
	options?: { folderId?: string | null },
): Promise<UploadedMedia> {
	const t = site.createTranslator(editorMessages);
	const prepared: PreparedUpload = input instanceof File ? { file: input, optimized: false } : input;
	const { file, original } = prepared;
	// Server stays the authority. This only spares the user an upload that would be refused.
	if (file.size > site.api.MAX_MEDIA_BYTES || (original && original.size > site.api.MAX_MEDIA_BYTES))
		throw new NoticeError(t("upload.tooLarge", { mb: site.api.MAX_MEDIA_BYTES / 1024 / 1024 }));

	// A preview of a screen runs on a draft site: nothing is uploaded from it (the storage PUT below included).
	if (isSandboxSite(site)) throw new NoticeError(site.createTranslator(apiErrorMessages)("previewNoWrite"));
	const ticket = await uploadCall(site, () =>
		requestUpload(
			site,
			{
				filename: original?.name ?? file.name,
				mimeType: file.type,
				byteSize: file.size,
				...(options?.folderId ? { folderId: options.folderId } : {}),
				...(original ? { original: { mimeType: original.type, byteSize: original.size } } : {}),
			},
			t("upload.prepareFailed"),
		),
	);

	const total = file.size + (original?.size ?? 0);
	let publicLoaded = 0;
	let originalLoaded = 0;
	const report = () => onProgress?.(Math.round(((publicLoaded + originalLoaded) / total) * 100));
	await Promise.all([
		putFile(site, ticket, file, (loaded) => {
			publicLoaded = loaded;
			report();
		}),
		original && ticket.original
			? putFile(site, ticket.original, original, (loaded) => {
					originalLoaded = loaded;
					report();
				})
			: Promise.resolve(),
	]);

	const result = await uploadCall(site, () => completeUpload(site, ticket.mediaId, t("upload.completeFailed")));
	return {
		mediaId: result.mediaId,
		publicUrl: result.publicUrl ?? null,
		width: result.width,
		height: result.height,
		defaultAlt: result.defaultAlt ?? "",
		defaultCaption: result.defaultCaption ?? "",
	};
}

export const formatBytes = (bytes: number) =>
	bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)}MB` : `${Math.max(1, Math.round(bytes / 1024))}KB`;

/**
 * Uploads an attachment file. The format is decided by the file name extension (browsers give inconsistent types for code files).
 * Rejects before uploading if the format is not accepted or the site setting limit (`media.maxFileBytes`) is exceeded.
 */
export async function uploadAttachment(
	site: Site,
	file: File,
	onProgress?: (percent: number) => void,
	options?: { folderId?: string | null },
): Promise<{ mediaId: string }> {
	const t = site.createTranslator(editorMessages);
	// A preview of a screen runs on a draft site: nothing is uploaded from it.
	if (isSandboxSite(site)) throw new NoticeError(site.createTranslator(apiErrorMessages)("previewNoWrite"));
	const mimeType = site.api.fileTypeFor(file.name);
	if (!mimeType) throw new NoticeError(t("upload.unsupportedType"));
	if (file.size > site.api.MAX_FILE_BYTES)
		throw new NoticeError(t("upload.tooLarge", { mb: site.api.MAX_FILE_BYTES / 1024 / 1024 }));
	const typed = file.type === mimeType ? file : new File([file], file.name, { type: mimeType });
	const uploaded = await uploadImageFile(site, typed, onProgress, options);
	return { mediaId: uploaded.mediaId };
}
