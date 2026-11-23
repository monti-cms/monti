import { S3Client } from "@aws-sdk/client-s3";
import { DEFAULT_ALLOWED_MIME_TYPES, DEFAULT_MAX_SIZE, MAX_ALLOWED_SIZE, normalizeMimeList } from "./policy";
import type { ResolvedS3Config, S3StorageOptions, UploadPolicy } from "./types";

const DEFAULT_TICKET_SECONDS = 600;
const MAX_TICKET_SECONDS = 3600;

/** 직접 넘긴 옵션과 환경 변수에서 공백을 제거한 문자열 값을 읽는다. 비어 있으면 `undefined`다. */
function readValue(
	value: string | undefined,
	env: Readonly<Record<string, string | undefined>>,
	name: string,
): string | undefined {
	const trimmed = (value ?? env[name])?.trim();
	return trimmed || undefined;
}

/**
 * 공개 URL이 쿼리·프래그먼트·계정 정보 없는 HTTP(S) 절대 주소인지 검사하고 끝 `/`를 제거한다.
 * 거절 오류에는 주소 원문·계정 정보를 담지 않는다. `new URL`의 `TypeError`는 `input`에 원문을 실으므로
 * 던지지 않는 `URL.parse`로 읽는다.
 */
function validatePublicUrl(raw: string): string {
	const parsed = URL.parse(raw);
	const valid =
		parsed !== null &&
		(parsed.protocol === "http:" || parsed.protocol === "https:") &&
		parsed.username === "" &&
		parsed.password === "" &&
		parsed.search === "" &&
		parsed.hash === "" &&
		!raw.includes("?") &&
		!raw.includes("#");
	if (!valid) {
		throw new Error("S3_PUBLIC_URL은 쿼리·프래그먼트·계정 정보 없는 HTTP(S) 주소여야 한다");
	}
	return `${parsed.origin}${parsed.pathname}`.replace(/\/+$/, "");
}

/** 정수 범위(`1..max`)를 검증한다. */
function positiveIntInRange(value: number, max: number, label: string): number {
	if (!Number.isInteger(value) || value < 1 || value > max) {
		throw new Error(`${label}는 1 이상 ${max} 이하의 정수여야 한다`);
	}
	return value;
}

/** 업로드 정책 옵션을 검증해 `UploadPolicy`로 정규화한다. */
function resolvePolicy(options: S3StorageOptions): UploadPolicy {
	const maxSize = positiveIntInRange(options.maxSize ?? DEFAULT_MAX_SIZE, MAX_ALLOWED_SIZE, "maxSize");
	const allowedMimeTypes = normalizeMimeList(options.allowedMimeTypes ?? DEFAULT_ALLOWED_MIME_TYPES);
	return { allowedMimeTypes, maxSize };
}

/** 경로 스타일 옵션을 해석한다. 환경 변수는 `"true"` 또는 `"1"`일 때만 켠다. */
function resolveForcePathStyle(options: S3StorageOptions, env: Readonly<Record<string, string | undefined>>): boolean {
	if (options.forcePathStyle !== undefined) return options.forcePathStyle;
	const raw = readValue(undefined, env, "S3_FORCE_PATH_STYLE");
	return raw === "true" || raw === "1";
}

/** 누락된 필수 연결 설정의 환경 변수 이름 목록을 모은다. */
function missingRequired(values: Record<string, string | undefined>): string[] {
	const lacking: string[] = [];
	if (!values.bucket) lacking.push("S3_BUCKET");
	if (!values.accessKeyId) lacking.push("S3_ACCESS_KEY_ID");
	if (!values.secretAccessKey) lacking.push("S3_SECRET_ACCESS_KEY");
	if (!values.publicUrl) lacking.push("S3_PUBLIC_URL");
	if (!values.region && !values.endpoint) lacking.push("S3_REGION", "S3_ENDPOINT");
	return lacking;
}

/** 옵션과 환경 변수에서 S3 연결·업로드 정책 설정을 해석하고 검증한다. */
export function resolveS3Config(options: S3StorageOptions = {}): ResolvedS3Config {
	const env = options.env ?? process.env;
	const bucket = readValue(options.bucket, env, "S3_BUCKET");
	const accessKeyId = readValue(options.accessKeyId, env, "S3_ACCESS_KEY_ID");
	const secretAccessKey = readValue(options.secretAccessKey, env, "S3_SECRET_ACCESS_KEY");
	const publicUrl = readValue(options.publicUrl, env, "S3_PUBLIC_URL");
	const endpoint = readValue(options.endpoint, env, "S3_ENDPOINT");
	const region = readValue(options.region, env, "S3_REGION");
	const lacking = missingRequired({ bucket, accessKeyId, secretAccessKey, publicUrl, endpoint, region });
	if (lacking.length > 0 || !bucket || !accessKeyId || !secretAccessKey || !publicUrl) {
		throw new Error(`필수 S3 설정이 비어 있다: ${lacking.join(", ")}`);
	}
	return {
		bucket,
		accessKeyId,
		secretAccessKey,
		publicUrl: validatePublicUrl(publicUrl),
		region: region ?? "auto",
		endpoint,
		forcePathStyle: resolveForcePathStyle(options, env),
		ticketSeconds: positiveIntInRange(
			options.ticketSeconds ?? DEFAULT_TICKET_SECONDS,
			MAX_TICKET_SECONDS,
			"ticketSeconds",
		),
		policy: resolvePolicy(options),
	};
}

/** 정규화된 설정으로 R2·MinIO 호환 옵션을 포함한 `S3Client`를 만든다. */
export function createS3Client(config: ResolvedS3Config): S3Client {
	return new S3Client({
		region: config.region,
		...(config.endpoint ? { endpoint: config.endpoint } : {}),
		forcePathStyle: config.forcePathStyle,
		credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
		requestChecksumCalculation: "WHEN_REQUIRED",
		responseChecksumValidation: "WHEN_REQUIRED",
	});
}
