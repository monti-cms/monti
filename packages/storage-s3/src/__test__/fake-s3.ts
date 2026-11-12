import { createHash, createHmac } from "node:crypto";
import { createServer, type IncomingMessage } from "node:http";
import type { AddressInfo } from "node:net";

/**
 * A stand-in for an S3 bucket, for tests: it keeps objects in memory and answers the requests the storage makes (path-style:
 * `/<bucket>/<key>`), and a browser's preflight. It is strict where S3 is, so a test that passes here says something:
 * - every request is signed (Signature Version 4), in its headers or in its address, and the signature is worked out again from the request
 *   that arrived: a `PUT` of another type, size or key than an address was signed for is refused, and so is a request signed by nobody;
 * - a signed address is refused once it has run out (`X-Amz-Expires`), and when it carries any parameter but the signature's own: the
 *   checksum parameters newer SDKs add are ones storages other than AWS refuse;
 * - a signed address works as often as it is used until it runs out: a second `PUT` writes over the first, as on S3.
 * It is this file's reading of S3's rules, not S3: what was tried against a real bucket is in the package's README.
 */
export type FakeS3 = {
	endpoint: string;
	objects: Map<string, { bytes: Uint8Array; type: string; headers: Record<string, string> }>;
	/** The origins a browser may `PUT` from. */
	origins: string[];
	/** The bucket's clock; a test moves it to let an address run out. */
	now: () => number;
	close(): Promise<void>;
};

const hmac = (key: Buffer | string, text: string) => createHmac("sha256", key).update(text).digest();
const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");
/** What a signed address may carry: the signature's own parameters, and the operation's name, which the SDK adds. */
const SIGNED_QUERY = new Set([
	"X-Amz-Algorithm",
	"X-Amz-Content-Sha256",
	"X-Amz-Credential",
	"X-Amz-Date",
	"X-Amz-Expires",
	"X-Amz-Signature",
	"X-Amz-SignedHeaders",
	"x-id",
]);
/** `20261113T014822Z` as a time. */
const timeOf = (stamp: string) =>
	Date.parse(stamp.replace(/^(\d{4})(\d\d)(\d\d)T(\d\d)(\d\d)(\d\d)Z$/, "$1-$2-$3T$4:$5:$6Z"));

/** The signature S3 expects for the request that arrived, signed in its address (`inQuery`) or in its `authorization` header. */
function expectedSignature(request: IncomingMessage, secret: string, inQuery: boolean): string {
	const [path, query = ""] = (request.url ?? "").split("?");
	const pairs = query === "" ? [] : query.split("&").map((pair) => pair.split("=") as [string, string | undefined]);
	const inAddress = (name: string) => decodeURIComponent(pairs.find(([key]) => key === name)?.[1] ?? "");
	const inHeader = (name: string) =>
		new RegExp(`${name}=([^,\\s]+)`).exec(String(request.headers.authorization ?? ""))?.[1] ?? "";
	const signedHeaders = inQuery ? inAddress("X-Amz-SignedHeaders") : inHeader("SignedHeaders");
	const credential = inQuery ? inAddress("X-Amz-Credential") : inHeader("Credential");
	const stamp = inQuery ? inAddress("X-Amz-Date") : String(request.headers["x-amz-date"] ?? "");
	const canonical = [
		request.method,
		path,
		pairs
			.filter(([name]) => name !== "X-Amz-Signature")
			.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
			.map(([name, text]) => `${name}=${text ?? ""}`)
			.join("&"),
		...signedHeaders.split(";").map(
			(name) =>
				`${name}:${String(request.headers[name] ?? "")
					.trim()
					.replace(/\s+/g, " ")}`,
		),
		"",
		signedHeaders,
		inQuery ? "UNSIGNED-PAYLOAD" : String(request.headers["x-amz-content-sha256"] ?? ""),
	].join("\n");
	const [, date, region, service] = credential.split("/");
	const scope = `${date}/${region}/${service}/aws4_request`;
	const key = hmac(hmac(hmac(hmac(`AWS4${secret}`, date ?? ""), region ?? ""), service ?? ""), "aws4_request");
	return hmac(key, ["AWS4-HMAC-SHA256", stamp, scope, sha256(canonical)].join("\n")).toString("hex");
}

/** Why S3 would refuse the request before looking at the object, or `null`. */
function refusalOf(request: IncomingMessage, url: URL, secret: string, now: number): string | null {
	const given = url.searchParams.get("X-Amz-Signature");
	if (given === null) {
		const signed = /Signature=([0-9a-f]+)/.exec(String(request.headers.authorization ?? ""))?.[1];
		if (!signed) return "AccessDenied";
		return signed === expectedSignature(request, secret, false) ? null : "SignatureDoesNotMatch";
	}
	if ([...url.searchParams.keys()].some((name) => !SIGNED_QUERY.has(name))) return "InvalidArgument";
	if (given !== expectedSignature(request, secret, true)) return "SignatureDoesNotMatch";
	const until = timeOf(url.searchParams.get("X-Amz-Date") ?? "") + Number(url.searchParams.get("X-Amz-Expires")) * 1000;
	return now <= until ? null : "AccessDenied";
}

export async function fakeS3(secret: string): Promise<FakeS3> {
	const objects: FakeS3["objects"] = new Map();
	const origins: string[] = [];
	const bucket = { now: () => Date.now() };
	const server = createServer(async (request, response) => {
		const url = new URL(request.url ?? "/", "http://fake");
		const name = url.pathname.split("/").slice(2).join("/");
		const chunks: Buffer[] = [];
		for await (const chunk of request) chunks.push(chunk as Buffer);
		const body = Buffer.concat(chunks);
		const origin = request.headers.origin;
		const cors: Record<string, string> =
			origin && origins.includes(origin) ? { "access-control-allow-origin": origin, vary: "Origin" } : {};
		const error = (status: number, code: string) => {
			response.writeHead(status, { "content-type": "application/xml", ...cors });
			// A HEAD has no body to carry the code.
			response.end(
				request.method === "HEAD"
					? undefined
					: `<?xml version="1.0" encoding="UTF-8"?><Error><Code>${code}</Code><Message>${code}</Message></Error>`,
			);
		};

		if (request.method === "OPTIONS") {
			if (!origin || !origins.includes(origin)) return error(403, "AccessForbidden");
			response.writeHead(200, {
				...cors,
				"access-control-allow-methods": "PUT",
				"access-control-allow-headers": request.headers["access-control-request-headers"] ?? "",
			});
			return response.end();
		}
		const refused = refusalOf(request, url, secret, bucket.now());
		if (refused) return error(refused === "InvalidArgument" ? 400 : 403, refused);
		const found = objects.get(name);
		if (request.method === "PUT") {
			const source = request.headers["x-amz-copy-source"];
			if (typeof source === "string") {
				// A copy inside the bucket: the object goes as it is, its type and headers with it.
				const from = objects.get(decodeURIComponent(source).replace(/^\//, "").split("/").slice(1).join("/"));
				if (!from) return error(404, "NoSuchKey");
				objects.set(name, { ...from, bytes: from.bytes.slice() });
				response.writeHead(200, { "content-type": "application/xml" });
				return response.end(
					'<?xml version="1.0" encoding="UTF-8"?><CopyObjectResult><ETag>"fake"</ETag><LastModified>2026-01-01T00:00:00.000Z</LastModified></CopyObjectResult>',
				);
			}
			objects.set(name, {
				bytes: new Uint8Array(body),
				type: request.headers["content-type"] ?? "binary/octet-stream",
				headers: Object.fromEntries(Object.entries(request.headers).map(([key, value]) => [key, String(value)])),
			});
			response.writeHead(200, { etag: '"fake"', ...cors });
			return response.end();
		}
		if (request.method === "DELETE") {
			objects.delete(name);
			response.writeHead(204);
			return response.end();
		}
		if (request.method === "HEAD") {
			response.writeHead(
				found ? 200 : 404,
				found ? { "content-length": found.bytes.length, "content-type": found.type } : {},
			);
			return response.end();
		}
		if (request.method === "GET") {
			if (!found) return error(404, "NoSuchKey");
			const range = /^bytes=(\d+)-(\d+)$/.exec(request.headers.range ?? "");
			if (range && Number(range[1]) >= found.bytes.length) return error(416, "InvalidRange");
			const bytes = range ? found.bytes.subarray(Number(range[1]), Number(range[2]) + 1) : found.bytes;
			response.writeHead(range ? 206 : 200, { "content-length": bytes.length, "content-type": found.type });
			return response.end(bytes);
		}
		return error(405, "MethodNotAllowed");
	});
	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
	return Object.assign(bucket, {
		endpoint: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
		objects,
		origins,
		close: () =>
			new Promise<void>((resolve) => {
				server.closeAllConnections();
				server.close(() => resolve());
			}),
	});
}
