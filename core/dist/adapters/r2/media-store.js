import { CopyObjectCommand, DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client, } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ALLOWED_MEDIA_MIMES, } from "./types.js";
/** S3 API media store (R2, S3, MinIO, etc.). Uploads via presigned URLs, then the server verifies and moves the file. */
export function createS3MediaStore(config) {
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
        prepareUpload: async (input) => {
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
        headFile: async (input) => {
            try {
                const res = await s3.send(new HeadObjectCommand({
                    Bucket: config.bucket,
                    Key: input.key,
                }), { abortSignal: input.signal });
                return {
                    key: input.key,
                    contentType: res.ContentType || "application/octet-stream",
                    contentLength: res.ContentLength || 0,
                    etag: res.ETag,
                    lastModified: res.LastModified,
                };
            }
            catch (err) {
                const error = err;
                if (error?.name === "NotFound" || error?.$metadata?.httpStatusCode === 404) {
                    return null;
                }
                throw err;
            }
        },
        readPrefix: async (input) => {
            const res = await s3.send(new GetObjectCommand({
                Bucket: config.bucket,
                Key: input.key,
                Range: `bytes=0-${Math.max(0, input.bytes - 1)}`,
            }), { abortSignal: input.signal });
            return res.Body ? new Uint8Array(await res.Body.transformToByteArray()) : new Uint8Array(0);
        },
        readFile: async (input) => {
            const res = await s3.send(new GetObjectCommand({
                Bucket: config.bucket,
                Key: input.key,
            }), { abortSignal: input.signal });
            if (!res.Body) {
                return new Uint8Array(0);
            }
            const stream = res.Body;
            const chunks = [];
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
        promoteFile: async (input) => {
            if (!ALLOWED_MEDIA_MIMES.includes(input.contentType)) {
                throw new Error(`Disallowed media mime type: ${input.contentType}`);
            }
            // 1. Copy from staging to final key with ETag precondition
            await s3.send(new CopyObjectCommand({
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
            }));
            // 2. Head final key to verify
            const headRes = await s3.send(new HeadObjectCommand({
                Bucket: config.bucket,
                Key: input.finalKey,
            }));
            // 3. Best-effort delete staging key
            try {
                await s3.send(new DeleteObjectCommand({
                    Bucket: config.bucket,
                    Key: input.stagingKey,
                }));
            }
            catch {
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
        deleteFile: async (input) => {
            try {
                await s3.send(new DeleteObjectCommand({
                    Bucket: config.bucket,
                    Key: input.key,
                }), { abortSignal: input.signal });
            }
            catch (error) {
                // S3 DeleteObject succeeds even for missing keys. Only a 404 counts as already deleted; for any other failure, raise it so
                // the caller leaves the `deleting` state and retries.
                const status = error?.$metadata?.httpStatusCode;
                if (status === 404)
                    return;
                throw error;
            }
        },
        getPublicUrl: (finalKey) => {
            const cleanBase = config.publicBaseUrl.replace(/\/+$/, "");
            const cleanKey = finalKey.replace(/^\/+/, "");
            return `${cleanBase}/${cleanKey}`;
        },
    };
}
export { detectImageDimensionsAndType } from "../../media/image-detect.js";
