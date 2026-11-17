import {
	CopyObjectCommand,
	DeleteObjectCommand,
	GetObjectCommand,
	HeadObjectCommand,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { isMediaKey, type Storage } from "@monti-cms/core";

/**
 * Monti's media files in a storage that speaks the S3 API: AWS S3, Cloudflare R2, MinIO (docs/design/features/20-release.md). Each value is
 * read from the environment unless it is given here.
 */
export type S3StorageOptions = {
	/** `S3_BUCKET`. */
	bucket?: string;
	/** `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY`. */
	accessKeyId?: string;
	secretAccessKey?: string;
	/** `S3_PUBLIC_URL`: the start of the address files are read from (the public bucket, or the CDN in front of it). A file's is `<this>/<key>`. */
	publicUrl?: string;
	/** `S3_REGION`. Left out with an endpoint it is `auto`, which is R2's. */
	region?: string;
	/** `S3_ENDPOINT`: the storage's own address, for one that is not AWS (R2: `https://<account>.r2.cloudflarestorage.com`). */
	endpoint?: string;
	/** `S3_FORCE_PATH_STYLE`: the bucket in the path, not the host name (MinIO). */
	forcePathStyle?: boolean;
	/**
	 * How long a signed upload address works, in seconds (600 unless given). It must stay well under the day the site keeps an unclaimed
	 * upload for: what is sent to an address is cleaned up by the key's own row, which must outlive the address.
	 */
	ticketSeconds?: number;
	/** Where the values are read from; the process's environment unless given. */
	env?: Readonly<Record<string, string | undefined>>;
};

/** How long a signed upload address works, in seconds. A file of the largest size goes up well within it on a slow line. */
const TICKET_SECONDS = 600;
/** A key is written once and never changed (a replaced file gets a new key), so a cache may keep it for good. */
const CACHE = "public, max-age=31536000, immutable";
/**
 * What a browser does with a file opened at its address: a picture shows in place, anything else is saved, never drawn. The bucket's address
 * serves whatever is in it under its own origin, without the headers the site's own file route adds (`nosniff`, a sandbox), so a PDF or a
 * text file must not open there as a page. The library takes no SVG and no HTML, so every picture here is one that cannot run anything.
 */
const dispositionOf = (mime: string) => (mime.startsWith("image/") ? undefined : "attachment");

/** Whether an S3 error says the key is not there. */
const missing = (error: unknown) => {
	const found = error as { name?: string; $metadata?: { httpStatusCode?: number } };
	return found?.name === "NotFound" || found?.name === "NoSuchKey" || found?.$metadata?.httpStatusCode === 404;
};
/** Whether it says the range asked for is past the file's end: a file with no bytes. */
const noSuchRange = (error: unknown) =>
	(error as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode === 416;

/**
 * The S3 storage. Its values are read when it is first used, not when the config loads, so a site builds without them; a value that is
 * missing then is an error that names it and where it goes.
 *
 * - Files are read by anyone at `S3_PUBLIC_URL/<key>`: the bucket is public, or a CDN in front of it is. No file gets an ACL (R2 takes none);
 *   who may read is the bucket's setting.
 * - A browser sends a file straight to the bucket (`ticket`): the address is signed for one `PUT` of one key, of one type and one size. The
 *   bucket must let the site's address `PUT` to it (CORS); `monti doctor` checks that and prints the setting. The address works until it
 *   runs out, more than once: the site copies what it checked to a key of its own (`copy`), so a second `PUT` changes nothing it uses.
 */
export function s3Storage(options: S3StorageOptions = {}): Storage {
	let opened: { client: S3Client; bucket: string; publicUrl: string } | undefined;
	const open = () => {
		if (opened) return opened;
		const env = options.env ?? process.env;
		const given = (value: string | undefined, name: string) => {
			const found = value ?? env[name];
			return found === undefined || found.trim() === "" ? undefined : found.trim();
		};
		const bucket = given(options.bucket, "S3_BUCKET");
		const accessKeyId = given(options.accessKeyId, "S3_ACCESS_KEY_ID");
		const secretAccessKey = given(options.secretAccessKey, "S3_SECRET_ACCESS_KEY");
		const publicUrl = given(options.publicUrl, "S3_PUBLIC_URL");
		const endpoint = given(options.endpoint, "S3_ENDPOINT");
		const region = given(options.region, "S3_REGION");
		const lacking = [
			...(bucket ? [] : ["S3_BUCKET"]),
			...(accessKeyId ? [] : ["S3_ACCESS_KEY_ID"]),
			...(secretAccessKey ? [] : ["S3_SECRET_ACCESS_KEY"]),
			...(publicUrl ? [] : ["S3_PUBLIC_URL"]),
			// AWS is found by its region; any other storage by its own address.
			...(region || endpoint ? [] : ["S3_REGION (AWS) or S3_ENDPOINT (R2, MinIO)"]),
		];
		if (!bucket || !accessKeyId || !secretAccessKey || !publicUrl || lacking.length > 0)
			throw new Error(
				`The S3 storage has no ${lacking.join(", ")}: set ${lacking.length === 1 ? "it" : "them"} in .env.local, or in the host's environment.`,
			);
		const pathStyle = options.forcePathStyle ?? ["1", "true"].includes(given(undefined, "S3_FORCE_PATH_STYLE") ?? "");
		opened = {
			client: new S3Client({
				region: region ?? "auto",
				...(endpoint ? { endpoint } : {}),
				forcePathStyle: pathStyle,
				credentials: { accessKeyId, secretAccessKey },
				// The SDK's newer default adds a checksum to every upload: storages other than AWS refuse it, and a signed address cannot carry it.
				requestChecksumCalculation: "WHEN_REQUIRED",
				responseChecksumValidation: "WHEN_REQUIRED",
			}),
			bucket,
			publicUrl: publicUrl.replace(/\/+$/, ""),
		};
		return opened;
	};
	/** The bucket and the key of a request, after the key is checked: nothing but a key the server made names a file. */
	const at = (key: string) => {
		if (!isMediaKey(key)) throw new Error(`"${key}" is no media key.`);
		return { Bucket: open().bucket, Key: key };
	};

	return {
		async put(key, bytes, { mime }) {
			await open().client.send(
				new PutObjectCommand({
					...at(key),
					Body: bytes,
					ContentType: mime,
					CacheControl: CACHE,
					ContentDisposition: dispositionOf(mime),
				}),
			);
		},
		async stat(key) {
			try {
				const found = await open().client.send(new HeadObjectCommand(at(key)));
				return { size: found.ContentLength ?? 0, mime: found.ContentType ?? "application/octet-stream" };
			} catch (error) {
				if (missing(error)) return null;
				throw error;
			}
		},
		async read(key) {
			try {
				const found = await open().client.send(new GetObjectCommand(at(key)));
				const bytes = (await found.Body?.transformToByteArray()) ?? new Uint8Array();
				return { bytes, mime: found.ContentType ?? "application/octet-stream" };
			} catch (error) {
				if (missing(error)) return null;
				throw error;
			}
		},
		async readStart(key, length) {
			try {
				const found = await open().client.send(new GetObjectCommand({ ...at(key), Range: `bytes=0-${length - 1}` }));
				return (await found.Body?.transformToByteArray()) ?? new Uint8Array();
			} catch (error) {
				if (missing(error)) return null;
				if (noSuchRange(error)) return new Uint8Array();
				throw error;
			}
		},
		async remove(key) {
			await open().client.send(new DeleteObjectCommand(at(key)));
		},
		url: (key) => `${open().publicUrl}/${key}`,
		async copy(from, to) {
			// Inside the storage: the bytes do not come through the site. The type, the cache header and the disposition go with the file.
			await open().client.send(new CopyObjectCommand({ ...at(to), CopySource: `${open().bucket}/${at(from).Key}` }));
		},
		async ticket(key, { mime, size }) {
			const disposition = dispositionOf(mime);
			const url = await getSignedUrl(
				open().client,
				new PutObjectCommand({ ...at(key), ContentType: mime, ContentLength: size, ContentDisposition: disposition }),
				// The type is signed with the address (the presigner leaves it out unless told), so the bucket takes this file's type and no other.
				{
					expiresIn: options.ticketSeconds ?? TICKET_SECONDS,
					signableHeaders: new Set(["content-type", "content-length", "content-disposition"]),
				},
			);
			return {
				url,
				headers: {
					"content-type": mime,
					"cache-control": CACHE,
					...(disposition ? { "content-disposition": disposition } : {}),
				},
			};
		},
	};
}
