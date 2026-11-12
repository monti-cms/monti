import { afterAll, describe, expect, it } from "vitest";
import { type FakeS3, fakeS3 } from "./__test__/fake-s3";
import { s3Storage } from "./index";

const SECRET = "the-secret-access-key-of-the-test";
let bucket: FakeS3;
const storage = () =>
	s3Storage({
		env: {
			S3_BUCKET: "media",
			S3_ACCESS_KEY_ID: "test-key-id",
			S3_SECRET_ACCESS_KEY: SECRET,
			S3_PUBLIC_URL: "https://cdn.example.com/files/",
			S3_ENDPOINT: bucket.endpoint,
			S3_FORCE_PATH_STYLE: "true",
		},
	});
bucket = await fakeS3(SECRET);
afterAll(() => bucket.close());

const KEY = "3f2a1c9e-1111-4222-8333-444455556666.png";
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

describe("s3Storage", () => {
	it("20-10 keeps a file's bytes and type under its key, until it is removed: the storage contract of the folder storage", async () => {
		const files = storage();
		expect(await files.stat(KEY)).toBeNull();
		expect(await files.read(KEY)).toBeNull();
		await files.put(KEY, PNG, { mime: "image/png" });
		expect(await files.stat(KEY)).toEqual({ size: PNG.length, mime: "image/png" });
		const read = await files.read(KEY);
		expect(read?.mime).toBe("image/png");
		expect([...(read?.bytes ?? [])]).toEqual([...PNG]);
		await files.remove(KEY);
		expect(await files.read(KEY)).toBeNull();
		// Removing what is not there is no error.
		await files.remove(KEY);
	});

	it("20-10 a key the server did not make names no file: nothing is asked of the bucket", async () => {
		const files = storage();
		await expect(files.put("../outside.png", PNG, { mime: "image/png" })).rejects.toThrow(/media key/);
		await expect(files.read("../../etc/passwd")).rejects.toThrow(/media key/);
		await expect(files.ticket?.("a/b.png", { mime: "image/png", size: 1 })).rejects.toThrow(/media key/);
		expect([...bucket.objects.keys()]).toEqual([]);
	});

	it("20-10 a file is read at the public address, and goes up with no ACL and a cache header that fits a key written once", async () => {
		const files = storage();
		expect(files.url(KEY)).toBe(`https://cdn.example.com/files/${KEY}`);
		await files.put(KEY, PNG, { mime: "image/png" });
		const sent = bucket.objects.get(KEY)?.headers ?? {};
		// R2 takes no ACL: who may read is the bucket's setting.
		expect(Object.keys(sent).filter((name) => name.includes("acl"))).toEqual([]);
		// Nor the SDK's default checksum, which storages other than AWS refuse.
		expect(Object.keys(sent).filter((name) => name.startsWith("x-amz-checksum"))).toEqual([]);
		expect(sent["cache-control"]).toBe("public, max-age=31536000, immutable");
		expect([...((await files.readStart?.(KEY, 4)) ?? [])]).toEqual([0x89, 0x50, 0x4e, 0x47]);
		expect(await files.readStart?.("00000000-0000-4000-8000-000000000000.png", 4)).toBeNull();
		await files.remove(KEY);
	});

	it("20-10 a value that is missing is an error that names it and where it goes, when the storage is first used and not before", async () => {
		// Making it reads nothing: a site builds without the values.
		const bare = s3Storage({ env: {} });
		await expect(bare.stat(KEY)).rejects.toThrow(
			"The S3 storage has no S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_PUBLIC_URL, S3_REGION (AWS) or S3_ENDPOINT (R2, MinIO): set them in .env.local, or in the host's environment.",
		);
		const one = s3Storage({
			bucket: "media",
			accessKeyId: "id",
			secretAccessKey: "secret",
			endpoint: bucket.endpoint,
			env: { S3_PUBLIC_URL: " " },
		});
		expect(() => one.url(KEY)).toThrow("The S3 storage has no S3_PUBLIC_URL: set it in .env.local");
	});

	it("20-11 a ticket is an address a browser PUTs the file to: the bucket takes it, with the type and the size it was signed for", async () => {
		const files = storage();
		const ticket = await files.ticket?.(KEY, { mime: "image/png", size: PNG.length });
		if (!ticket) throw new Error("no ticket");
		const url = new URL(ticket.url);
		expect(url.pathname).toBe(`/media/${KEY}`);
		expect(url.searchParams.get("X-Amz-SignedHeaders")?.split(";")).toEqual(
			expect.arrayContaining(["content-length", "content-type", "host"]),
		);
		expect(Number(url.searchParams.get("X-Amz-Expires"))).toBe(600);
		// The address holds no secret, and the region of a storage that names none is R2's.
		expect(ticket.url).not.toContain(SECRET);
		expect(url.searchParams.get("X-Amz-Credential")).toContain("/auto/s3/aws4_request");
		expect(ticket.headers).toEqual({
			"content-type": "image/png",
			"cache-control": "public, max-age=31536000, immutable",
		});

		const sent = await fetch(ticket.url, { method: "PUT", headers: ticket.headers, body: PNG.slice().buffer });
		expect(sent.status).toBe(200);
		expect(await files.stat(KEY)).toEqual({ size: PNG.length, mime: "image/png" });
		await files.remove(KEY);
	});

	it("20-12 the address takes nothing else: another type, another size, another key or a changed address is refused, and nothing is stored", async () => {
		const files = storage();
		const ticket = await files.ticket?.(KEY, { mime: "image/png", size: PNG.length });
		if (!ticket) throw new Error("no ticket");
		const put = (url: string, type: string, body: Uint8Array) =>
			fetch(url, { method: "PUT", headers: { "content-type": type }, body: body.slice().buffer }).then(
				(answer) => answer.status,
			);
		expect(await put(ticket.url, "text/html", PNG)).toBe(403);
		expect(await put(ticket.url, "image/png", new Uint8Array(PNG.length + 1))).toBe(403);
		expect(await put(ticket.url.replace(KEY, "00000000-0000-4000-8000-000000000000.png"), "image/png", PNG)).toBe(403);
		expect(await put(`${ticket.url}&x-amz-acl=public-read`, "image/png", PNG)).toBe(403);
		expect([...bucket.objects.keys()]).toEqual([]);
	});
});
