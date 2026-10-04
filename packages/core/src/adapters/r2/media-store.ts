import {
	CopyObjectCommand,
	DeleteObjectCommand,
	GetObjectCommand,
	HeadObjectCommand,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
	ALLOWED_MEDIA_MIMES,
	type MediaStore,
	type MediaStoreConfig,
	type PrepareUploadInput,
	type PrepareUploadOutput,
	type PromoteFileInput,
	type StoredFileHead,
} from "./types";

/** S3 API 미디어 저장소(R2·S3·MinIO 등). 미리 서명한 주소로 올리고 서버가 확인한 뒤 옮긴다. */
export function createS3MediaStore(config: MediaStoreConfig): MediaStore {
	const s3 = new S3Client({
		region: config.region ?? "auto",
		endpoint: config.endpoint,
		...(config.forcePathStyle ? { forcePathStyle: true } : {}),
		credentials: {
			accessKeyId: config.accessKeyId,
			secretAccessKey: config.secretAccessKey,
		},
	});

	return {
		prepareUpload: async (input: PrepareUploadInput): Promise<PrepareUploadOutput> => {
			if (!ALLOWED_MEDIA_MIMES.includes(input.contentType)) {
				throw new Error(`Disallowed media mime type: ${input.contentType}`);
			}

			const command = new PutObjectCommand({
				Bucket: config.bucket,
				Key: input.stagingKey,
				ContentType: input.contentType,
			});

			const expiresIn = Math.min(Math.max(input.expiresInSeconds, 60), 900); // 1~15 mins, default 10m
			const url = await getSignedUrl(s3, command, { expiresIn });
			const expiresAt = new Date(Date.now() + expiresIn * 1000);

			return {
				url,
				method: "PUT",
				requiredHeaders: {
					"Content-Type": input.contentType,
				},
				expiresAt,
			};
		},

		headFile: async (input: { key: string; signal?: AbortSignal }): Promise<StoredFileHead | null> => {
			try {
				const res = await s3.send(
					new HeadObjectCommand({
						Bucket: config.bucket,
						Key: input.key,
					}),
					{ abortSignal: input.signal },
				);

				return {
					key: input.key,
					contentType: res.ContentType || "application/octet-stream",
					contentLength: res.ContentLength || 0,
					etag: res.ETag,
					lastModified: res.LastModified,
				};
			} catch (err) {
				const error = err as { name?: string; $metadata?: { httpStatusCode?: number } } | null;
				if (error?.name === "NotFound" || error?.$metadata?.httpStatusCode === 404) {
					return null;
				}
				throw err;
			}
		},

		readPrefix: async (input: { key: string; bytes: number; signal?: AbortSignal }): Promise<Uint8Array> => {
			const res = await s3.send(
				new GetObjectCommand({
					Bucket: config.bucket,
					Key: input.key,
					Range: `bytes=0-${Math.max(0, input.bytes - 1)}`,
				}),
				{ abortSignal: input.signal },
			);
			return res.Body ? new Uint8Array(await res.Body.transformToByteArray()) : new Uint8Array(0);
		},

		readFile: async (input: { key: string; maxBytes: number; signal?: AbortSignal }): Promise<Uint8Array> => {
			const res = await s3.send(
				new GetObjectCommand({
					Bucket: config.bucket,
					Key: input.key,
				}),
				{ abortSignal: input.signal },
			);

			if (!res.Body) {
				return new Uint8Array(0);
			}

			const stream = res.Body as AsyncIterable<Uint8Array>;
			const chunks: Uint8Array[] = [];
			let totalBytes = 0;

			for await (const chunk of stream) {
				const uint8 = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk);
				totalBytes += uint8.length;
				if (totalBytes > input.maxBytes) {
					throw new Error(`File exceeded max bytes limit of ${input.maxBytes}`);
				}
				chunks.push(uint8);
			}

			const result = new Uint8Array(totalBytes);
			let offset = 0;
			for (const chunk of chunks) {
				result.set(chunk, offset);
				offset += chunk.length;
			}
			return result;
		},

		promoteFile: async (input: PromoteFileInput): Promise<StoredFileHead> => {
			if (!ALLOWED_MEDIA_MIMES.includes(input.contentType)) {
				throw new Error(`Disallowed media mime type: ${input.contentType}`);
			}

			// 1. Copy from staging to final key with ETag precondition
			await s3.send(
				new CopyObjectCommand({
					Bucket: config.bucket,
					CopySource: `${config.bucket}/${input.stagingKey}`,
					Key: input.finalKey,
					// 글자 파일은 한글이 깨지지 않게 문자 집합을 붙인다.
					ContentType: input.contentType.startsWith("text/")
						? `${input.contentType}; charset=utf-8`
						: input.contentType,
					CacheControl: input.cacheControl || "public, max-age=31536000, immutable",
					...(input.contentDisposition ? { ContentDisposition: input.contentDisposition } : {}),
					MetadataDirective: "REPLACE",
					...(input.expectedEtag ? { CopySourceIfMatch: input.expectedEtag } : {}),
				}),
			);

			// 2. Head final key to verify
			const headRes = await s3.send(
				new HeadObjectCommand({
					Bucket: config.bucket,
					Key: input.finalKey,
				}),
			);

			// 3. Best-effort delete staging key
			try {
				await s3.send(
					new DeleteObjectCommand({
						Bucket: config.bucket,
						Key: input.stagingKey,
					}),
				);
			} catch {
				// Ignore staging cleanup failure
			}

			return {
				key: input.finalKey,
				contentType: headRes.ContentType || input.contentType,
				contentLength: headRes.ContentLength || 0,
				etag: headRes.ETag,
				lastModified: headRes.LastModified,
			};
		},

		deleteFile: async (input: { key: string; signal?: AbortSignal }): Promise<void> => {
			try {
				await s3.send(
					new DeleteObjectCommand({
						Bucket: config.bucket,
						Key: input.key,
					}),
					{ abortSignal: input.signal },
				);
			} catch (error) {
				// S3 DeleteObject는 없는 키에도 성공한다. 404만 이미 지워진 것으로 보고, 그 밖의 실패는 올려
				// 호출자가 `deleting` 상태를 남겨 다시 시도하게 한다(§7.3).
				const status = (error as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
				if (status === 404) return;
				throw error;
			}
		},

		getPublicUrl: (finalKey: string): string => {
			const cleanBase = config.publicBaseUrl.replace(/\/+$/, "");
			const cleanKey = finalKey.replace(/^\/+/, "");
			return `${cleanBase}/${cleanKey}`;
		},
	};
}

export { detectImageDimensionsAndType, type ImageDimensionsAndType } from "../../media/image-detect";
