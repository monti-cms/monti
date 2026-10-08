import { problemText } from "@monti-cms/core";
import { createS3MediaStore } from "./media-store.js";
const envOf = (env, name) => env[name]?.trim() || undefined;
const WHERE_TO_SET = ".env.local (and the environment settings of your host)";
/** Examples that tell where each value comes from, for the services people use. */
const FIX_HINT = "R2: S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com and S3_REGION=auto. AWS S3: S3_REGION=<bucket region> (the endpoint follows from it). MinIO: S3_ENDPOINT=http://localhost:9000 and S3_FORCE_PATH_STYLE=true. S3_PUBLIC_URL is the start of the address the uploaded files are served from (a CDN or a public bucket)";
/** What `S3_*` names, the option that sets it, and what it is. */
const SETTINGS = [
    { env: "S3_BUCKET", option: "bucket", what: "bucket name" },
    { env: "S3_ACCESS_KEY_ID", option: "accessKeyId", what: "access key id" },
    { env: "S3_SECRET_ACCESS_KEY", option: "secretAccessKey", what: "secret access key" },
    { env: "S3_PUBLIC_URL", option: "publicBaseUrl", what: "public address of the files" },
];
const missing = (variable, option, what) => {
    throw new Error(problemText({
        what: `${variable} is not set, so uploads have no ${what}`,
        where: `${WHERE_TO_SET}, or \`s3Storage({ ${option} })\` in monti.config.ts`,
        fix: `set it. ${FIX_HINT}`,
    }));
};
/** The store config the options and the environment give, or the names of what is missing. */
function resolve(options, env) {
    const region = options.region || envOf(env, "S3_REGION");
    const endpoint = options.endpoint || envOf(env, "S3_ENDPOINT") || (region ? `https://s3.${region}.amazonaws.com` : undefined);
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
    if (lacking.length > 0)
        return { missing: lacking, partial: { endpoint, region, ...values } };
    return {
        config: {
            endpoint: endpoint,
            region,
            forcePathStyle: options.forcePathStyle ?? ["true", "1"].includes(envOf(env, "S3_FORCE_PATH_STYLE") ?? ""),
            bucket: values.bucket,
            accessKeyId: values.accessKeyId,
            secretAccessKey: values.secretAccessKey,
            publicBaseUrl: values.publicBaseUrl,
        },
    };
}
/**
 * S3 API store: AWS S3, Cloudflare R2, MinIO and any other store that speaks the S3 API. With no arguments everything comes from the `S3_*` environment variables: `S3_ENDPOINT`
 * (optional when `S3_REGION` is set), `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_URL` and
 * `S3_FORCE_PATH_STYLE`. Options override, each one on its own (a partial set of options is completed from the environment). The values are read on first use, so they may be empty while building.
 * Cloudflare R2: `S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com` and `S3_REGION=auto`. MinIO: `S3_ENDPOINT=http://localhost:9000` and `S3_FORCE_PATH_STYLE=true`.
 */
export function s3Storage(options = {}) {
    return {
        name: "s3",
        createStore: () => {
            const resolved = resolve(options, process.env);
            if ("missing" in resolved) {
                const [first] = resolved.missing;
                if (first?.startsWith("S3_ENDPOINT"))
                    return missing("S3_ENDPOINT", "endpoint", "S3 API address");
                const setting = SETTINGS.find((item) => item.env === first);
                if (setting)
                    return missing(setting.env, setting.option, setting.what);
            }
            return createS3MediaStore(resolved.config);
        },
    };
}
