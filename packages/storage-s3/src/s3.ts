import type { MediaAdapter } from "@monti-cms/core/server";
import { createS3MediaStore, type MediaStoreConfig } from "./media-store";

/** Connection settings. Anything left out is read from the `S3_*` environment variables, on first use. */
export interface S3StorageOptions {
	/** S3 API URL. Env `S3_ENDPOINT`. When unset and a region is known, `https://s3.<region>.amazonaws.com`. */
	readonly endpoint?: string;
	/** Bucket region. Env `S3_REGION`. */
	readonly region?: string;
	/** Env `S3_BUCKET`. */
	readonly bucket?: string;
	/** Env `S3_ACCESS_KEY_ID`. */
	readonly accessKeyId?: string;
	/** Env `S3_SECRET_ACCESS_KEY`. */
	readonly secretAccessKey?: string;
	/** Start of the public URL of uploaded files (CDN or public bucket). Env `S3_PUBLIC_URL`. */
	readonly publicBaseUrl?: string;
	/** Path-style URLs (`<endpoint>/<bucket>/<key>`), needed by MinIO. Env `S3_FORCE_PATH_STYLE` (`true` or `1`). */
	readonly forcePathStyle?: boolean;
}

const env = (name: string): string | undefined => process.env[name]?.trim() || undefined;

const missing = (variable: string, option: string): never => {
	throw new Error(`\`${variable}\` is empty; set it, or pass \`s3Storage({ ${option} })\``);
};

/** An option wins over its environment variable. A missing required value is an error naming the variable. */
function pick(key: string, option: string, value: string | undefined): string {
	return value || env(`S3_${key}`) || missing(`S3_${key}`, option);
}

/**
 * S3 API store: AWS S3, Cloudflare R2, MinIO and any other store that speaks the S3 API. With no arguments everything comes from the `S3_*` environment variables: `S3_ENDPOINT`
 * (optional when `S3_REGION` is set), `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_URL` and
 * `S3_FORCE_PATH_STYLE`. Options override, each one on its own (a partial set of options is completed from the environment). The values are read on first use, so they may be empty while building.
 * Cloudflare R2: `S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com` and `S3_REGION=auto`. MinIO: `S3_ENDPOINT=http://localhost:9000` and `S3_FORCE_PATH_STYLE=true`.
 */
export function s3Storage(options: S3StorageOptions = {}): MediaAdapter {
	return {
		name: "s3",
		createStore: () => {
			const region = options.region || env("S3_REGION");
			const endpoint =
				options.endpoint ||
				env("S3_ENDPOINT") ||
				(region ? `https://s3.${region}.amazonaws.com` : missing("S3_ENDPOINT", "endpoint"));
			const config: MediaStoreConfig = {
				endpoint,
				region,
				forcePathStyle: options.forcePathStyle ?? ["true", "1"].includes(env("S3_FORCE_PATH_STYLE") ?? ""),
				bucket: pick("BUCKET", "bucket", options.bucket),
				accessKeyId: pick("ACCESS_KEY_ID", "accessKeyId", options.accessKeyId),
				secretAccessKey: pick("SECRET_ACCESS_KEY", "secretAccessKey", options.secretAccessKey),
				publicBaseUrl: pick("PUBLIC_URL", "publicBaseUrl", options.publicBaseUrl),
			};
			return createS3MediaStore(config);
		},
	};
}
