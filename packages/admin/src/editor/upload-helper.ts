import { cmsApiUrl, createTranslator, fileTypeFor, MAX_FILE_BYTES } from "@monti-cms/core/client";
import { cmsApiErrorMessage } from "../screens/api-error-message";
import { editorMessages } from "./messages";

const t = createTranslator(editorMessages);

/**
 * Browser image upload. Shared by the editor and the media library.
 *
 * 1. (Optional) Web optimization: converts static JPEG, PNG, and WebP to WebP with the long edge at most 2560px. The original is kept as part of the same media.
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

const readBytes = (blob: Blob): Promise<ArrayBuffer> =>
	typeof blob.arrayBuffer === "function"
		? blob.arrayBuffer()
		: new Promise((resolve, reject) => {
				const reader = new FileReader();
				reader.onload = () => resolve(reader.result as ArrayBuffer);
				reader.onerror = () => reject(reader.error);
				reader.readAsArrayBuffer(blob);
			});

/** Whether the WebP has an animation chunk (`ANIM`). */
async function isAnimatedWebp(file: File): Promise<boolean> {
	const head = new Uint8Array(await readBytes(file.slice(0, 64 * 1024)));
	for (let i = 12; i < head.length - 4; i++) {
		if (head[i] === 0x41 && head[i + 1] === 0x4e && head[i + 2] === 0x49 && head[i + 3] === 0x4d) return true;
	}
	return false;
}

/**
 * Web optimization. If it cannot convert or conversion is not a gain, returns the original as is and records the reason.
 * Never silently turns an animation into a still image.
 */
export async function prepareUpload(
	file: File,
	options: { optimize: boolean; policy?: OptimizePolicy } = { optimize: false },
): Promise<PreparedUpload> {
	if (!options.optimize) return { file, optimized: false };
	const policy = options.policy ?? DEFAULT_OPTIMIZE_POLICY;
	if (!policy.formats.includes(file.type)) {
		return { file, optimized: false, skippedReason: t("upload.keepFormat") };
	}
	if (file.type === "image/webp" && (await isAnimatedWebp(file))) {
		return { file, optimized: false, skippedReason: t("upload.keepAnimated") };
	}
	if (typeof createImageBitmap !== "function" || typeof document === "undefined") {
		return { file, optimized: false, skippedReason: t("upload.noConvert") };
	}

	let bitmap: ImageBitmap;
	try {
		bitmap = await createImageBitmap(file);
	} catch {
		return { file, optimized: false, skippedReason: t("upload.unreadable") };
	}
	const scale = Math.min(1, policy.maxEdge / Math.max(bitmap.width, bitmap.height));
	const width = Math.round(bitmap.width * scale);
	const height = Math.round(bitmap.height * scale);
	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	canvas.getContext("2d")?.drawImage(bitmap, 0, 0, width, height);
	bitmap.close();

	const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, policy.outputType, policy.quality));
	// Browsers that do not support WebP encoding return PNG.
	if (!blob || blob.type !== policy.outputType) {
		return { file, optimized: false, skippedReason: t("upload.noWebp") };
	}
	if (scale === 1 && blob.size >= file.size) {
		return { file, optimized: false, skippedReason: t("upload.originalSmaller"), width, height };
	}
	return {
		file: new File([blob], policy.rename(file.name), { type: policy.outputType }),
		original: file,
		optimized: true,
		width,
		height,
	};
}

interface UploadTicket {
	uploadUrl: string;
	requiredHeaders?: Record<string, string>;
}

function putFile(ticket: UploadTicket, file: File, onProgress?: (loaded: number) => void): Promise<void> {
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

const errorMessage = async (response: Response, fallback: string) =>
	cmsApiErrorMessage(await response.json().catch(() => null), fallback);

export interface UploadedMedia {
	mediaId: string;
	publicUrl: string | null;
	width: number;
	height: number;
	defaultAlt: string;
	defaultCaption: string;
}

export async function uploadImageFile(
	input: File | PreparedUpload,
	onProgress?: (percent: number) => void,
): Promise<UploadedMedia> {
	const prepared: PreparedUpload = input instanceof File ? { file: input, optimized: false } : input;
	const { file, original } = prepared;

	const prepareRes = await fetch(cmsApiUrl("/v1/media/uploads"), {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			filename: original?.name ?? file.name,
			mimeType: file.type,
			byteSize: file.size,
			...(original ? { original: { mimeType: original.type, byteSize: original.size } } : {}),
		}),
	});
	if (!prepareRes.ok) throw new Error(await errorMessage(prepareRes, t("upload.prepareFailed")));
	const ticket = (await prepareRes.json()) as UploadTicket & { mediaId: string; original?: UploadTicket };

	const total = file.size + (original?.size ?? 0);
	let publicLoaded = 0;
	let originalLoaded = 0;
	const report = () => onProgress?.(Math.round(((publicLoaded + originalLoaded) / total) * 100));
	await Promise.all([
		putFile(ticket, file, (loaded) => {
			publicLoaded = loaded;
			report();
		}),
		original && ticket.original
			? putFile(ticket.original, original, (loaded) => {
					originalLoaded = loaded;
					report();
				})
			: Promise.resolve(),
	]);

	const completeRes = await fetch(cmsApiUrl(`/v1/media/${ticket.mediaId}/complete`), {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: "{}",
	});
	if (!completeRes.ok) throw new Error(await errorMessage(completeRes, t("upload.completeFailed")));
	const result = await completeRes.json();
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
	file: File,
	onProgress?: (percent: number) => void,
): Promise<{ mediaId: string }> {
	const mimeType = fileTypeFor(file.name);
	if (!mimeType) throw new Error(t("upload.unsupportedType"));
	if (file.size > MAX_FILE_BYTES) throw new Error(t("upload.tooLarge", { mb: MAX_FILE_BYTES / 1024 / 1024 }));
	const typed = file.type === mimeType ? file : new File([file], file.name, { type: mimeType });
	const uploaded = await uploadImageFile(typed, onProgress);
	return { mediaId: uploaded.mediaId };
}
