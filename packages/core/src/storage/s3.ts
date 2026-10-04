/**
 * S3 API 미디어 저장소(`@monti-cms/core/s3`, M17-1). 서버 설정의 `media`에 넣는다. AWS SDK(`@aws-sdk/client-s3`·
 * `@aws-sdk/s3-request-presigner`)는 이 진입점을 쓰는 사이트만 설치한다(선택 의존성).
 *
 * ```ts
 * media: r2Storage({ endpoint, bucket, accessKeyId, secretAccessKey, publicBaseUrl })
 * media: s3Storage({ endpoint: "https://s3.ap-northeast-2.amazonaws.com", region: "ap-northeast-2", … })
 * media: s3Storage({ endpoint: "http://localhost:9000", forcePathStyle: true, … })   // MinIO
 * ```
 */
import { createS3MediaStore } from "../adapters/r2/media-store";
import type { MediaStoreConfig } from "../adapters/r2/types";
import type { MediaAdapter } from "../server/define";

/** 값이 비어 있어도 되는 연결(빌드 중에는 환경 변수가 없을 수 있다). 처음 쓸 때 빠진 값이 있으면 오류다. */
export type S3StorageOptions = { readonly [K in keyof MediaStoreConfig]: MediaStoreConfig[K] | undefined };

const REQUIRED = ["accessKeyId", "secretAccessKey", "bucket", "endpoint", "publicBaseUrl"] as const;

/** S3 API 저장소(AWS S3·MinIO 등). `region`은 버킷 지역, MinIO는 `forcePathStyle: true`. */
export function s3Storage(options: S3StorageOptions, name = "s3"): MediaAdapter {
	return {
		name,
		createStore: () => {
			const missing = REQUIRED.filter((key) => !options[key]);
			if (missing.length > 0) throw new Error(`cms.server: ${name}Storage is missing ${missing.join(", ")}`);
			return createS3MediaStore(options as MediaStoreConfig);
		},
	};
}

/** Cloudflare R2. 지역은 `auto`다. */
export type R2Options = Omit<S3StorageOptions, "region" | "forcePathStyle">;

export const r2Storage = (options: R2Options): MediaAdapter => s3Storage({ ...options, region: "auto" }, "r2");

export type { MediaStoreConfig } from "../adapters/r2/types";
