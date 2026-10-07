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

/** Cloudflare R2. The region is always `auto`. Anything left out is read from the `R2_*` environment variables. */
export interface R2Options {
	/** S3 API URL. Env `R2_ENDPOINT`. When unset, built from the account ID. */
	readonly endpoint?: string;
	/** Cloudflare account ID, used to build the endpoint. Env `R2_ACCOUNT_ID`. */
	readonly accountId?: string;
	/** Env `R2_BUCKET`. */
	readonly bucket?: string;
	/** Env `R2_ACCESS_KEY_ID`. */
	readonly accessKeyId?: string;
	/** Env `R2_SECRET_ACCESS_KEY`. */
	readonly secretAccessKey?: string;
	/** Start of the public URL of uploaded files (custom domain or `r2.dev` URL). Env `R2_PUBLIC_URL`. */
	readonly publicBaseUrl?: string;
}

const env = (name: string): string | undefined => process.env[name]?.trim() || undefined;

const missing = (fn: string, variable: string, option: string): never => {
	throw new Error(`${fn}: ${variable} is not set (set the environment variable, or pass \`${option}\`)`);
};

/** An option wins over its environment variable. A missing required value is an error naming the variable. */
function pick(fn: string, prefix: string, key: string, option: string, value: string | undefined): string {
	return value || env(`${prefix}_${key}`) || missing(fn, `${prefix}_${key}`, option);
}

/**
 * S3 API store (AWS S3, MinIO and others). With no arguments everything comes from the `S3_*` environment variables: `S3_ENDPOINT`
 * (optional when `S3_REGION` is set), `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_URL` and
 * `S3_FORCE_PATH_STYLE`. Options override. The values are read on first use, so they may be empty while building.
 */
export function s3Storage(options: S3StorageOptions = {}): MediaAdapter {
	return {
		name: "s3",
		createStore: () => {
			const region = options.region || env("S3_REGION");
			const endpoint =
				options.endpoint ||
				env("S3_ENDPOINT") ||
				(region ? `https://s3.${region}.amazonaws.com` : missing("s3Storage", "S3_ENDPOINT", "endpoint"));
			const config: MediaStoreConfig = {
				endpoint,
				region,
				forcePathStyle: options.forcePathStyle ?? ["true", "1"].includes(env("S3_FORCE_PATH_STYLE") ?? ""),
				bucket: pick("s3Storage", "S3", "BUCKET", "bucket", options.bucket),
				accessKeyId: pick("s3Storage", "S3", "ACCESS_KEY_ID", "accessKeyId", options.accessKeyId),
				secretAccessKey: pick("s3Storage", "S3", "SECRET_ACCESS_KEY", "secretAccessKey", options.secretAccessKey),
				publicBaseUrl: pick("s3Storage", "S3", "PUBLIC_URL", "publicBaseUrl", options.publicBaseUrl),
			};
			return createS3MediaStore(config);
		},
	};
}

/**
 * Cloudflare R2. With no arguments everything comes from the `R2_*` environment variables: `R2_ACCOUNT_ID` (or `R2_ENDPOINT`),
 * `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` and `R2_PUBLIC_URL`. Options override. The values are read on first use.
 */
export function r2Storage(options: R2Options = {}): MediaAdapter {
	return {
		name: "r2",
		createStore: () => {
			const endpoint =
				options.endpoint ||
				env("R2_ENDPOINT") ||
				`https://${pick("r2Storage", "R2", "ACCOUNT_ID", "accountId", options.accountId)}.r2.cloudflarestorage.com`;
			return createS3MediaStore({
				endpoint,
				region: "auto",
				bucket: pick("r2Storage", "R2", "BUCKET", "bucket", options.bucket),
				accessKeyId: pick("r2Storage", "R2", "ACCESS_KEY_ID", "accessKeyId", options.accessKeyId),
				secretAccessKey: pick("r2Storage", "R2", "SECRET_ACCESS_KEY", "secretAccessKey", options.secretAccessKey),
				publicBaseUrl: pick("r2Storage", "R2", "PUBLIC_URL", "publicBaseUrl", options.publicBaseUrl),
			});
		},
	};
}
