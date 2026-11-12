import { createHash, createHmac } from "node:crypto";
import { createServer, type IncomingMessage } from "node:http";
import type { AddressInfo } from "node:net";

/**
 * A stand-in for an S3 bucket, for tests: it keeps objects in memory and answers the five requests the storage makes (path-style:
 * `/<bucket>/<key>`), and a browser's preflight. A request with a signed address (`X-Amz-Signature` in the query) is checked as S3 checks it:
 * the signature is worked out again from the request that arrived, so a `PUT` of another type or size than the address was signed for is
 * refused. It is this file's reading of S3's rule, not S3: what was not tried against a real bucket is said in the package's README.
 */
export type FakeS3 = {
	endpoint: string;
	objects: Map<string, { bytes: Uint8Array; type: string; headers: Record<string, string> }>;
	/** The origins a browser may `PUT` from. */
	origins: string[];
	close(): Promise<void>;
};

const hmac = (key: Buffer | string, text: string) => createHmac("sha256", key).update(text).digest();
const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");

/** The signature S3 expects for a request that came to a signed address (Signature Version 4, in the query, the payload unsigned). */
function expectedSignature(request: IncomingMessage, secret: string): string {
	const [path, query = ""] = (request.url ?? "").split("?");
	const pairs = query.split("&").map((pair) => pair.split("=") as [string, string]);
	const value = (name: string) => decodeURIComponent(pairs.find(([key]) => key === name)?.[1] ?? "");
	const signedHeaders = value("X-Amz-SignedHeaders");
	const canonical = [
		request.method,
		path,
		pairs
			.filter(([name]) => name !== "X-Amz-Signature")
			.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
			.map(([name, text]) => `${name}=${text}`)
			.join("&"),
		...signedHeaders.split(";").map((name) => `${name}:${String(request.headers[name] ?? "").trim()}`),
		"",
		signedHeaders,
		"UNSIGNED-PAYLOAD",
	].join("\n");
	const [, date, region, service] = value("X-Amz-Credential").split("/");
	const scope = `${date}/${region}/${service}/aws4_request`;
	const key = hmac(hmac(hmac(hmac(`AWS4${secret}`, date ?? ""), region ?? ""), service ?? ""), "aws4_request");
	return hmac(key, ["AWS4-HMAC-SHA256", value("X-Amz-Date"), scope, sha256(canonical)].join("\n")).toString("hex");
}

export async function fakeS3(secret: string): Promise<FakeS3> {
	const objects: FakeS3["objects"] = new Map();
	const origins: string[] = [];
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
			response.end(
				`<?xml version="1.0" encoding="UTF-8"?><Error><Code>${code}</Code><Message>${code}</Message></Error>`,
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
		if (
			url.searchParams.has("X-Amz-Signature") &&
			url.searchParams.get("X-Amz-Signature") !== expectedSignature(request, secret)
		)
			return error(403, "SignatureDoesNotMatch");
		const found = objects.get(name);
		if (request.method === "PUT") {
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
	return {
		endpoint: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
		objects,
		origins,
		close: () =>
			new Promise((resolve) => {
				server.closeAllConnections();
				server.close(() => resolve());
			}),
	};
}
