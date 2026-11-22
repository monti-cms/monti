import { DeleteObjectCommand, HeadObjectCommand, PutObjectCommand, type S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { StorageAdapter } from "@monti-cms/core";
import { createS3Client, resolveS3Config } from "./config";
import { assertSafeKey, CACHE_CONTROL, dispositionOf, validateUploadPolicy } from "./policy";
import type { ResolvedS3Config, S3StorageOptions } from "./types";

interface OpenedS3 {
	client: S3Client;
	config: ResolvedS3Config;
}

/** AWS SDK v3가 기본 서명 대상에서 빼는 헤더(`content-type`, `cache-control`)를 명시적으로 서명에 포함한다. */
const SIGNABLE_HEADERS = new Set(["content-type", "cache-control"]);

/** S3 오류 객체의 `name` 속성. */
function errorName(error: unknown): string | undefined {
	return error instanceof Error ? error.name : undefined;
}

/** 클라이언트가 `PUT` 요청에 실어 보낼 업로드 헤더를 만든다. */
function uploadHeaders(mime: string, disposition: "attachment" | undefined): Record<string, string> {
	const headers: Record<string, string> = {
		"content-type": mime,
		"cache-control": CACHE_CONTROL,
		"if-none-match": "*",
	};
	if (disposition !== undefined) headers["content-disposition"] = disposition;
	return headers;
}

async function issueTicket(open: () => OpenedS3, key: string, info: { mime: string; size: number }) {
	assertSafeKey(key);
	const { client, config } = open();
	const mime = validateUploadPolicy(info, config.policy);
	const disposition = dispositionOf(mime);
	const command = new PutObjectCommand({
		Bucket: config.bucket,
		Key: key,
		ContentType: mime,
		ContentLength: info.size,
		CacheControl: CACHE_CONTROL,
		IfNoneMatch: "*",
		...(disposition ? { ContentDisposition: disposition } : {}),
	});
	const signedUrl = await getSignedUrl(client, command, {
		expiresIn: config.ticketSeconds,
		signableHeaders: SIGNABLE_HEADERS,
	});
	return { url: signedUrl, headers: uploadHeaders(mime, disposition) };
}

async function headObject(open: () => OpenedS3, key: string) {
	assertSafeKey(key);
	const { client, config } = open();
	try {
		const found = await client.send(new HeadObjectCommand({ Bucket: config.bucket, Key: key }));
		return { mime: found.ContentType ?? "application/octet-stream", size: found.ContentLength ?? 0 };
	} catch (error) {
		if (errorName(error) === "NotFound") return null;
		throw error;
	}
}

async function deleteObject(open: () => OpenedS3, key: string): Promise<void> {
	assertSafeKey(key);
	const { client, config } = open();
	try {
		await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }));
	} catch (error) {
		// `DELETE`에서는 `NoSuchBucket`(404)과 구분하기 위해 오류 이름이 정확히 `NoSuchKey`일 때만 미존재로 본다.
		if (errorName(error) === "NoSuchKey") return;
		throw error;
	}
}

/** S3 호환 객체 저장소(AWS S3·Cloudflare R2·MinIO)용 `StorageAdapter`를 만든다. 설정은 첫 사용 시 해석한다. */
export function s3Storage(options: S3StorageOptions = {}): StorageAdapter {
	let opened: OpenedS3 | undefined;

	function open(): OpenedS3 {
		if (opened !== undefined) return opened;
		const config = resolveS3Config(options);
		opened = { client: createS3Client(config), config };
		return opened;
	}

	function ticket(key: string, info: { mime: string; size: number }) {
		return issueTicket(open, key, info);
	}

	function stat(key: string) {
		return headObject(open, key);
	}

	function url(key: string): string {
		assertSafeKey(key);
		return `${open().config.publicUrl}/${key}`;
	}

	function remove(key: string): Promise<void> {
		return deleteObject(open, key);
	}

	return { ticket, stat, url, remove };
}
