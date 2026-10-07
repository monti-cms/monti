import {
	CopyObjectCommand,
	DeleteObjectCommand,
	GetObjectCommand,
	HeadBucketCommand,
	HeadObjectCommand,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
	ALLOWED_MEDIA_MIMES,
	type MediaStore,
	type PrepareUploadInput,
	type PrepareUploadOutput,
	type PromoteFileInput,
	type StoredFileHead,
} from "@monti-cms/core/server";

/** S3 API store connection (R2, S3, MinIO, etc.). */
export interface MediaStoreConfig {
	accessKeyId: string;
	secretAccessKey: string;
	bucket: string;
	/** S3 API URL (R2: `https://<account>.r2.cloudflarestorage.com`, AWS S3: `https://s3.<region>.amazonaws.com`). */
	endpoint: string;
	/** Start of the public URL (CDN or public bucket URL). The public URL of an uploaded file is `<publicBaseUrl>/<key>`. */
	publicBaseUrl: string;
	/** Region. R2 uses `auto` (default), AWS S3 the bucket region (e.g. `ap-northeast-2`). */
	region?: string;
	/** Path-style URL (`<endpoint>/<bucket>/<key>`). Turn on for stores like MinIO. */
	forcePathStyle?: boolean;
}

/** S3 API media store (R2, S3, MinIO, etc.). Uploads via presigned URLs, then the server verifies and moves the file. */
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
					// Text files get a charset so Korean does not get garbled.
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
				// S3 DeleteObject succeeds even for missing keys. Only a 404 counts as already deleted; for any other failure, raise it so
				// the caller leaves the `deleting` state and retries.
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

/** Why the keys cannot use the bucket, and what to change. */
export interface BucketProblem {
	readonly message: string;
	readonly where: string;
	readonly fix: string;
}

interface S3ErrorShape {
	readonly name?: string;
	readonly code?: string;
	readonly message?: string;
	readonly $metadata?: { readonly httpStatusCode?: number };
}

/**
 * Asks the store whether the keys can reach the bucket (`HEAD` on the bucket: no object is read or written). Returns `undefined` when they can, else what is
 * wrong in plain words. A network call; `monti doctor --online` is the one caller.
 */
export async function checkBucketAccess(config: MediaStoreConfig): Promise<BucketProblem | undefined> {
	const s3 = new S3Client({
		region: config.region ?? "auto",
		endpoint: config.endpoint,
		...(config.forcePathStyle ? { forcePathStyle: true } : {}),
		credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
		maxAttempts: 1,
		requestHandler: { requestTimeout: 10_000, connectionTimeout: 8_000 },
	});
	try {
		await s3.send(new HeadBucketCommand({ Bucket: config.bucket }));
		return undefined;
	} catch (error) {
		const failure = error as S3ErrorShape;
		const status = failure.$metadata?.httpStatusCode;
		const name = failure.name ?? failure.code ?? "";
		const host = new URL(config.endpoint).host;
		if (status === 404 || name === "NotFound" || name === "NoSuchBucket") {
			return {
				message: `the bucket "${config.bucket}" does not exist at ${host}`,
				where: "S3_BUCKET and S3_ENDPOINT",
				fix: "create the bucket in your storage provider, or correct S3_BUCKET; check that S3_ENDPOINT (and S3_REGION) is the one of the account that owns it",
			};
		}
		if (status === 301 || name === "PermanentRedirect") {
			return {
				message: `the bucket "${config.bucket}" is in another region than "${config.region ?? "(none)"}"`,
				where: "S3_REGION",
				fix: "set S3_REGION to the region the bucket was created in",
			};
		}
		if (
			status === 403 ||
			name === "Forbidden" ||
			name === "AccessDenied" ||
			name === "InvalidAccessKeyId" ||
			name === "SignatureDoesNotMatch"
		) {
			return {
				message: `the storage at ${host} refused the keys for bucket "${config.bucket}"`,
				where: "S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY",
				fix: "copy the access key id and secret again (no spaces around them), and give the key read and write access to this bucket; on R2 create an API token with Object Read & Write for the bucket",
			};
		}
		if (
			/ENOTFOUND|ECONNREFUSED|EAI_AGAIN|ETIMEDOUT|ECONNRESET|timed out|getaddrinfo/i.test(
				`${failure.code ?? ""} ${failure.message ?? ""} ${name}`,
			)
		) {
			return {
				message: `the storage at ${host} cannot be reached`,
				where: "S3_ENDPOINT",
				fix: "check the address for a typo and that the store is running (MinIO: `docker compose up -d`), and that this machine can reach it",
			};
		}
		return {
			message: `the storage at ${host} answered with an error: ${failure.message ?? name ?? "unknown"}`,
			where: "S3_ENDPOINT, S3_BUCKET and the keys",
			fix: "check the S3_* values against your storage provider's dashboard",
		};
	} finally {
		s3.destroy();
	}
}
