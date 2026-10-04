import { cmsApiUrl, createTranslator, fileTypeFor, MAX_FILE_BYTES } from "@monti-cms/core/client";
import { cmsApiErrorMessage } from "../screens/api-error-message";
import { editorMessages } from "./messages";

const t = createTranslator(editorMessages);

/**
 * 브라우저 이미지 업로드(§7.1·§7.2). 편집기와 미디어 라이브러리가 같이 쓴다.
 *
 * 1. (선택) 웹용 최적화: 정적 JPEG·PNG·WebP를 긴 변 2560px 이하 WebP로 바꾼다. 원본도 같은 미디어로 보관한다.
 * 2. 서버에 업로드 준비를 요청하고 받은 URL로 저장소에 직접 올린다(파일이 앱 서버를 거치지 않는다).
 * 3. 완료 확인을 요청한다. 서버가 실제 바이트를 검사한 뒤에만 `ready`가 된다.
 */

export interface OptimizePolicy {
	/** 변환 대상 형식. 애니메이션 GIF·WebP와 지원이 불확실한 형식은 원본을 유지한다. */
	readonly formats: readonly string[];
	readonly maxEdge: number;
	readonly quality: number;
	readonly outputType: "image/webp";
	/** 변환한 파일의 이름. */
	readonly rename: (name: string) => string;
}

/** 기본 최적화 정책. 코드에서 바꿀 수 있다(§7.1 "기본 정책은 코드로 바꿀 수 있다"). */
export const DEFAULT_OPTIMIZE_POLICY: OptimizePolicy = {
	formats: ["image/jpeg", "image/png", "image/webp"],
	maxEdge: 2560,
	quality: 0.9,
	outputType: "image/webp",
	rename: (name) => `${name.replace(/\.[^.]+$/, "") || "image"}.webp`,
};

export interface PreparedUpload {
	/** 공개용으로 올릴 파일. 최적화하지 않으면 원본 그대로다. */
	file: File;
	/** 최적화한 경우의 원본 파일. */
	original?: File;
	optimized: boolean;
	/** 최적화를 건너뛴 이유(사용자 안내용). */
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

/** WebP의 애니메이션 청크(`ANIM`)가 있는가. */
async function isAnimatedWebp(file: File): Promise<boolean> {
	const head = new Uint8Array(await readBytes(file.slice(0, 64 * 1024)));
	for (let i = 12; i < head.length - 4; i++) {
		if (head[i] === 0x41 && head[i + 1] === 0x4e && head[i + 2] === 0x49 && head[i + 3] === 0x4d) return true;
	}
	return false;
}

/**
 * 웹용 최적화. 변환할 수 없거나 변환이 이득이 아니면 원본을 그대로 돌려주고 이유를 남긴다.
 * 애니메이션을 조용히 정지 이미지로 바꾸지 않는다(§7.1).
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
	// WebP 인코딩을 지원하지 않는 브라우저는 PNG를 돌려준다.
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
 * 첨부 파일(v3)을 올린다. 형식은 파일 이름의 확장자로 정한다(브라우저가 코드 파일의 형식을 제각각 준다).
 * 받지 않는 형식이거나 사이트 설정 한도(`media.maxFileBytes`)를 넘으면 올리기 전에 거절한다.
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
