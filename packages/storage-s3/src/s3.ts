import { type DoctorCheck, fail, ok, problemText, skip, warn } from "@monti-cms/core";
import type { MediaAdapter } from "@monti-cms/core/server";
import { checkBucketAccess, createS3MediaStore, type MediaStoreConfig } from "./media-store";

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

type Env = Readonly<Record<string, string | undefined>>;

const envOf = (env: Env, name: string): string | undefined => env[name]?.trim() || undefined;

const WHERE_TO_SET = ".env.local (and the environment settings of your host)";

/** Examples that tell where each value comes from, for the services people use. */
const FIX_HINT =
	"R2: S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com and S3_REGION=auto. AWS S3: S3_REGION=<bucket region> (the endpoint follows from it). MinIO: S3_ENDPOINT=http://localhost:9000 and S3_FORCE_PATH_STYLE=true. S3_PUBLIC_URL is the start of the address the uploaded files are served from (a CDN or a public bucket)";

/** What `S3_*` names, the option that sets it, and what it is. */
const SETTINGS = [
	{ env: "S3_BUCKET", option: "bucket", what: "bucket name" },
	{ env: "S3_ACCESS_KEY_ID", option: "accessKeyId", what: "access key id" },
	{ env: "S3_SECRET_ACCESS_KEY", option: "secretAccessKey", what: "secret access key" },
	{ env: "S3_PUBLIC_URL", option: "publicBaseUrl", what: "public address of the files" },
] as const satisfies readonly { env: string; option: keyof S3StorageOptions; what: string }[];

const missing = (variable: string, option: string, what: string): never => {
	throw new Error(
		problemText({
			what: `${variable} is not set, so uploads have no ${what}`,
			where: `${WHERE_TO_SET}, or \`s3Storage({ ${option} })\` in monti.config.ts`,
			fix: `set it. ${FIX_HINT}. \`monti doctor\` checks all the S3_* values`,
		}),
	);
};

/** The store config the options and the environment give, or the names of what is missing. */
function resolve(
	options: S3StorageOptions,
	env: Env,
):
	| { readonly config: MediaStoreConfig }
	| { readonly missing: readonly string[]; readonly partial: Partial<MediaStoreConfig> } {
	const region = options.region || envOf(env, "S3_REGION");
	const endpoint =
		options.endpoint || envOf(env, "S3_ENDPOINT") || (region ? `https://s3.${region}.amazonaws.com` : undefined);
	const values = {
		bucket: options.bucket || envOf(env, "S3_BUCKET"),
		accessKeyId: options.accessKeyId || envOf(env, "S3_ACCESS_KEY_ID"),
		secretAccessKey: options.secretAccessKey || envOf(env, "S3_SECRET_ACCESS_KEY"),
		publicBaseUrl: options.publicBaseUrl || envOf(env, "S3_PUBLIC_URL"),
	};
	const lacking = [
		...(endpoint ? [] : ["S3_ENDPOINT (or S3_REGION)"]),
		...SETTINGS.filter((setting) => !values[setting.option]).map((setting) => setting.env),
	];
	if (lacking.length > 0) return { missing: lacking, partial: { endpoint, region, ...values } };
	return {
		config: {
			endpoint: endpoint as string,
			region,
			forcePathStyle: options.forcePathStyle ?? ["true", "1"].includes(envOf(env, "S3_FORCE_PATH_STYLE") ?? ""),
			bucket: values.bucket as string,
			accessKeyId: values.accessKeyId as string,
			secretAccessKey: values.secretAccessKey as string,
			publicBaseUrl: values.publicBaseUrl as string,
		},
	};
}

const isUrl = (value: string): boolean => {
	try {
		return ["http:", "https:"].includes(new URL(value).protocol);
	} catch {
		return false;
	}
};

/** The checks `s3Storage()` adds to `monti doctor`: are the `S3_*` values there and well formed, and (with `--online`) can the keys reach the bucket. */
function s3Checks(options: S3StorageOptions): readonly DoctorCheck[] {
	const settings: DoctorCheck = {
		id: "settings",
		title: "S3 settings",
		run: ({ env }) => {
			const resolved = resolve(options, env);
			if ("missing" in resolved) {
				return fail(
					`${resolved.missing.join(", ")} ${resolved.missing.length === 1 ? "is" : "are"} not set, so uploads cannot work`,
					{
						where: `${WHERE_TO_SET}, or the options of \`s3Storage()\``,
						fix: `set ${resolved.missing.length === 1 ? "it" : "them"}. ${FIX_HINT}`,
					},
				);
			}
			const { config } = resolved;
			if (!isUrl(config.endpoint)) {
				return fail(`the S3 endpoint "${config.endpoint}" is not an http(s) address`, {
					where: "S3_ENDPOINT",
					fix: "write it with the scheme, for example S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com",
				});
			}
			if (!isUrl(config.publicBaseUrl)) {
				return fail(`S3_PUBLIC_URL "${config.publicBaseUrl}" is not an http(s) address`, {
					where: "S3_PUBLIC_URL",
					fix: "use the address the uploaded files are served from, with the scheme: https://cdn.your-domain.com",
				});
			}
			const host = new URL(config.endpoint).hostname;
			if (/\.r2\.cloudflarestorage\.com$/.test(host) && config.region !== "auto") {
				return warn(`Cloudflare R2 is used with the region "${config.region ?? "(none)"}"`, {
					where: "S3_REGION",
					fix: "set S3_REGION=auto for R2",
				});
			}
			if (/^(localhost|127\.|\[::1\])/.test(host) && !config.forcePathStyle) {
				return warn(`the endpoint ${host} looks like MinIO or another local store, which needs path-style URLs`, {
					where: "S3_FORCE_PATH_STYLE",
					fix: "set S3_FORCE_PATH_STYLE=true",
				});
			}
			return ok(
				`bucket "${config.bucket}" at ${new URL(config.endpoint).host}, files served from ${config.publicBaseUrl}`,
			);
		},
	};
	const bucket: DoctorCheck = {
		id: "bucket",
		title: "Bucket access",
		online: true,
		run: async ({ env }) => {
			const resolved = resolve(options, env);
			if ("missing" in resolved) return skip("not checked: the S3 settings are incomplete (see above)");
			const problem = await checkBucketAccess(resolved.config);
			return problem
				? fail(problem.message, { where: problem.where, fix: problem.fix })
				: ok(`the keys can reach bucket "${resolved.config.bucket}"`);
		},
	};
	return [settings, bucket];
}

/**
 * S3 API store: AWS S3, Cloudflare R2, MinIO and any other store that speaks the S3 API. With no arguments everything comes from the `S3_*` environment variables: `S3_ENDPOINT`
 * (optional when `S3_REGION` is set), `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_URL` and
 * `S3_FORCE_PATH_STYLE`. Options override, each one on its own (a partial set of options is completed from the environment). The values are read on first use, so they may be empty while building.
 * Cloudflare R2: `S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com` and `S3_REGION=auto`. MinIO: `S3_ENDPOINT=http://localhost:9000` and `S3_FORCE_PATH_STYLE=true`.
 * `monti doctor` checks the values, and with `--online` the access to the bucket.
 */
export function s3Storage(options: S3StorageOptions = {}): MediaAdapter {
	return {
		name: "s3",
		checks: s3Checks(options),
		createStore: () => {
			const resolved = resolve(options, process.env);
			if ("missing" in resolved) {
				const [first] = resolved.missing;
				if (first?.startsWith("S3_ENDPOINT")) return missing("S3_ENDPOINT", "endpoint", "S3 API address");
				const setting = SETTINGS.find((item) => item.env === first);
				if (setting) return missing(setting.env, setting.option, setting.what);
			}
			return createS3MediaStore((resolved as { config: MediaStoreConfig }).config);
		},
	};
}
