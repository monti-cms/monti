import { MontiError } from "@monti-cms/core";
import type { UploadPolicy } from "./types";

/** 키는 한 번 쓰이고 교체 시 새 키를 쓰므로 영구 캐시 헤더를 붙인다. */
export const CACHE_CONTROL = "public, max-age=31536000, immutable";

/** 기본 최대 업로드 크기(10 MiB). */
export const DEFAULT_MAX_SIZE = 10 * 1024 * 1024;

/** `core`의 `media.size` 컬럼(PostgreSQL `integer`)이 담을 수 있는 최대 바이트 크기. */
export const MAX_ALLOWED_SIZE = 2_147_483_647;

/** 기본 허용 MIME 목록. 스크립트 실행 위험이 있는 SVG·HTML 계열은 제외한다. */
export const DEFAULT_ALLOWED_MIME_TYPES = [
	"image/jpeg",
	"image/png",
	"image/webp",
	"image/gif",
	"image/avif",
	"application/pdf",
	"text/plain",
	"text/csv",
	"video/mp4",
	"video/webm",
	"audio/mpeg",
	"audio/wav",
	"audio/ogg",
	"application/zip",
] as const;

const UUID_KEY = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const MIME_TOKEN = /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/;

/** 소문자 UUID 형식의 파일 키만 통과시키고 그 외에는 `BAD_REQUEST`를 던진다. */
export function assertSafeKey(key: string): void {
	if (!UUID_KEY.test(key)) {
		throw new MontiError("BAD_REQUEST", `올바른 UUID 형식의 파일 키가 아니다: ${key}`);
	}
}

/** 허용 MIME 목록을 소문자로 정규화해 집합으로 만든다. 비어 있거나 파라미터가 붙은 잘못된 항목이 있으면 거절한다. */
export function normalizeMimeList(list: readonly string[]): ReadonlySet<string> {
	if (list.length === 0) throw new Error("allowedMimeTypes는 하나 이상의 MIME 타입을 포함해야 한다");
	const result = new Set<string>();
	for (const entry of list) {
		const normalized = entry.toLowerCase();
		if (!MIME_TOKEN.test(normalized)) {
			throw new Error(`올바른 MIME 타입 형식이 아니다: ${entry}`);
		}
		result.add(normalized);
	}
	return result;
}

/** 업로드 요청의 MIME과 크기를 정책과 대조해 정규화된 MIME을 돌려준다. 위반 시 `BAD_REQUEST`를 던진다. */
export function validateUploadPolicy(info: { mime: string; size: number }, policy: UploadPolicy): string {
	const mime = info.mime.toLowerCase();
	if (!policy.allowedMimeTypes.has(mime)) {
		throw new MontiError("BAD_REQUEST", `허용되지 않은 파일 형식이다: ${info.mime}`);
	}
	if (!Number.isInteger(info.size) || info.size < 1 || info.size > policy.maxSize) {
		throw new MontiError("BAD_REQUEST", `허용 크기를 벗어난 파일이다: ${info.size}`);
	}
	return mime;
}

/** SVG를 제외한 이미지는 브라우저에 바로 표시(`undefined`)하고, 그 외 형식과 SVG는 다운로드(`"attachment"`)로 지정한다. */
export function dispositionOf(mime: string): "attachment" | undefined {
	return mime.startsWith("image/") && mime !== "image/svg+xml" ? undefined : "attachment";
}
