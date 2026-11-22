import { createHash, createHmac } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

interface StoredObject {
	bytes: Uint8Array;
	contentType: string;
	cacheControl?: string;
	contentDisposition?: string;
}

export interface FakeS3Options {
	bucket?: string;
	accessKeyId?: string;
	secretAccessKey?: string;
	region?: string;
}

export interface FakeS3Server {
	endpoint: string;
	bucket: string;
	accessKeyId: string;
	secretAccessKey: string;
	region: string;
	objects: Map<string, StoredObject>;
	headError: "AccessDenied" | null;
	deleteError: "AccessDenied" | "NoSuchBucket" | "NoSuchKey" | null;
	seed(key: string, object: StoredObject): void;
	close(): Promise<void>;
}

const sha256Hex = (value: string | Uint8Array): string => createHash("sha256").update(value).digest("hex");

const hmac = (key: string | Buffer, data: string): Buffer => createHmac("sha256", key).update(data).digest();

function encodeRfc3986(value: string): string {
	return encodeURIComponent(value).replace(/[!'()*]/g, (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`);
}

function canonicalQuery(params: URLSearchParams): string {
	const pairs: [string, string][] = [];
	for (const [k, v] of params.entries()) {
		if (k !== "X-Amz-Signature") pairs.push([encodeRfc3986(k), encodeRfc3986(v)]);
	}
	pairs.sort((a, b) => (a[0] === b[0] ? a[1].localeCompare(b[1]) : a[0].localeCompare(b[0])));
	return pairs.map(([k, v]) => `${k}=${v}`).join("&");
}

function verifyPresignedPut(req: IncomingMessage, url: URL, secretAccessKey: string, accessKeyId: string): boolean {
	const credential = url.searchParams.get("X-Amz-Credential");
	const amzDate = url.searchParams.get("X-Amz-Date");
	const signedHeadersParam = url.searchParams.get("X-Amz-SignedHeaders");
	const signature = url.searchParams.get("X-Amz-Signature");
	if (!credential || !amzDate || !signedHeadersParam || !signature) return false;
	const [keyId, dateStamp, region, service, term] = credential.split("/");
	if (keyId !== accessKeyId || service !== "s3" || term !== "aws4_request") return false;

	const headerNames = signedHeadersParam.split(";");
	const canonicalHeaders = headerNames
		.map((name) => {
			const raw = req.headers[name];
			const value = Array.isArray(raw) ? raw.join(",") : (raw ?? "");
			return `${name}:${value.trim().replace(/\s+/g, " ")}\n`;
		})
		.join("");
	const payloadHash = url.searchParams.get("X-Amz-Content-Sha256") ?? "UNSIGNED-PAYLOAD";
	const canonicalRequest = [
		"PUT",
		url.pathname,
		canonicalQuery(url.searchParams),
		canonicalHeaders,
		signedHeadersParam,
		payloadHash,
	].join("\n");
	const scope = `${dateStamp}/${region}/s3/aws4_request`;
	const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256Hex(canonicalRequest)].join("\n");
	const kDate = hmac(`AWS4${secretAccessKey}`, dateStamp);
	const kRegion = hmac(kDate, region);
	const kService = hmac(kRegion, "s3");
	const kSigning = hmac(kService, "aws4_request");
	const expected = createHmac("sha256", kSigning).update(stringToSign).digest("hex");
	return expected === signature;
}

function sendXmlError(res: ServerResponse, status: number, code: string, message: string): void {
	const body = `<?xml version="1.0" encoding="UTF-8"?><Error><Code>${code}</Code><Message>${message}</Message></Error>`;
	res.writeHead(status, { "content-type": "application/xml" });
	res.end(body);
}

async function readBody(req: IncomingMessage): Promise<Uint8Array> {
	const chunks: Buffer[] = [];
	for await (const chunk of req) chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
	return new Uint8Array(Buffer.concat(chunks));
}

function singleHeader(req: IncomingMessage, name: string): string | undefined {
	const raw = req.headers[name];
	return Array.isArray(raw) ? raw[0] : raw;
}

export async function createFakeS3(options: FakeS3Options = {}): Promise<FakeS3Server> {
	const bucket = options.bucket ?? "monti-test";
	const accessKeyId = options.accessKeyId ?? "test-access-key";
	const secretAccessKey = options.secretAccessKey ?? "test-secret-key";
	const region = options.region ?? "auto";
	const objects = new Map<string, StoredObject>();

	const state: FakeS3Server = {
		endpoint: "",
		bucket,
		accessKeyId,
		secretAccessKey,
		region,
		objects,
		headError: null,
		deleteError: null,
		seed(key, object) {
			objects.set(key, object);
		},
		close: () =>
			new Promise<void>((resolve, reject) => {
				server.close((error) => (error ? reject(error) : resolve()));
			}),
	};

	const server: Server = createServer(async (req, res) => {
		const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "127.0.0.1"}`);
		const prefix = `/${bucket}/`;
		if (!url.pathname.startsWith(prefix)) {
			sendXmlError(res, 404, "NoSuchBucket", "The specified bucket does not exist");
			return;
		}
		const key = decodeURIComponent(url.pathname.slice(prefix.length));

		if (req.method === "PUT") {
			const bytes = await readBody(req);
			if (!verifyPresignedPut(req, url, secretAccessKey, accessKeyId)) {
				sendXmlError(res, 403, "SignatureDoesNotMatch", "The request signature we calculated does not match");
				return;
			}
			if (singleHeader(req, "if-none-match") === "*" && objects.has(key)) {
				sendXmlError(res, 412, "PreconditionFailed", "At least one of the pre-conditions you specified did not hold");
				return;
			}
			objects.set(key, {
				bytes,
				contentType: singleHeader(req, "content-type") ?? "application/octet-stream",
				cacheControl: singleHeader(req, "cache-control"),
				contentDisposition: singleHeader(req, "content-disposition"),
			});
			res.writeHead(200);
			res.end();
			return;
		}

		if (req.method === "HEAD") {
			if (state.headError === "AccessDenied") {
				res.writeHead(403);
				res.end();
				return;
			}
			const found = objects.get(key);
			if (!found) {
				res.writeHead(404);
				res.end();
				return;
			}
			res.writeHead(200, {
				"content-type": found.contentType,
				"content-length": String(found.bytes.byteLength),
				...(found.cacheControl ? { "cache-control": found.cacheControl } : {}),
				...(found.contentDisposition ? { "content-disposition": found.contentDisposition } : {}),
			});
			res.end();
			return;
		}

		if (req.method === "DELETE") {
			if (state.deleteError === "AccessDenied") {
				sendXmlError(res, 403, "AccessDenied", "Access Denied");
				return;
			}
			if (state.deleteError === "NoSuchBucket") {
				sendXmlError(res, 404, "NoSuchBucket", "The specified bucket does not exist");
				return;
			}
			if (state.deleteError === "NoSuchKey" && !objects.has(key)) {
				sendXmlError(res, 404, "NoSuchKey", "The specified key does not exist");
				return;
			}
			objects.delete(key);
			res.writeHead(204);
			res.end();
			return;
		}

		sendXmlError(res, 405, "MethodNotAllowed", "Method Not Allowed");
	});

	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
	const address = server.address() as AddressInfo;
	state.endpoint = `http://127.0.0.1:${address.port}`;
	return state;
}
