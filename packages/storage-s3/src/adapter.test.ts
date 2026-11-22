import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, expect, it } from "vitest";
import { createFakeS3, type FakeS3Server } from "./__test__/fake-s3";
import { s3Storage } from "./adapter";
import type { S3StorageOptions } from "./types";

let fakeS3: FakeS3Server;

beforeEach(async () => {
	fakeS3 = await createFakeS3();
});

afterEach(async () => {
	await fakeS3.close();
});

function adapterOf(overrides: Partial<S3StorageOptions> = {}) {
	return s3Storage({
		bucket: fakeS3.bucket,
		accessKeyId: fakeS3.accessKeyId,
		secretAccessKey: fakeS3.secretAccessKey,
		publicUrl: "https://cdn.example.com",
		endpoint: fakeS3.endpoint,
		forcePathStyle: true,
		env: {},
		...overrides,
	});
}

async function asyncCodeOf(run: Promise<unknown>): Promise<string | null> {
	return run.then(
		() => null,
		(error: { code?: string }) => error.code ?? null,
	);
}

function syncCodeOf(run: () => unknown): string | null {
	try {
		run();
		return null;
	} catch (error) {
		return (error as { code?: string }).code ?? null;
	}
}

it("S3-ADP-1 이미지 업로드 허가 주소로 파일을 올리면 버킷에 저장된다", async () => {
	const adapter = adapterOf({ ticketSeconds: 300 });
	const key = randomUUID();
	const body = new Uint8Array(16).fill(7);
	const ticket = await adapter.ticket(key, { mime: "image/png", size: body.byteLength });
	const parsed = new URL(ticket.url);
	const response = await fetch(ticket.url, { method: "PUT", headers: ticket.headers, body });
	const stored = fakeS3.objects.get(key);

	// S3-ADP-1.1
	expect(ticket.headers).toStrictEqual({
		"content-type": "image/png",
		"cache-control": "public, max-age=31536000, immutable",
		"if-none-match": "*",
	});
	// S3-ADP-1.2
	expect({
		expires: parsed.searchParams.get("X-Amz-Expires"),
		signedHeaders: parsed.searchParams.get("X-Amz-SignedHeaders"),
	}).toEqual({
		expires: "300",
		signedHeaders: "cache-control;content-length;content-type;host;if-none-match",
	});
	// S3-ADP-1.3
	expect({
		status: response.status,
		bytes: stored?.bytes,
		contentType: stored?.contentType,
		cacheControl: stored?.cacheControl,
	}).toEqual({
		status: 200,
		bytes: body,
		contentType: "image/png",
		cacheControl: "public, max-age=31536000, immutable",
	});
});

it("S3-ADP-2 이미지가 아닌 파일을 올릴 때는 열면 바로 내려받아지도록 헤더를 서명해 저장한다", async () => {
	const adapter = adapterOf();
	const key = randomUUID();
	const body = new Uint8Array(20).fill(3);
	const ticket = await adapter.ticket(key, { mime: "application/pdf", size: body.byteLength });
	const signedHeaders = new URL(ticket.url).searchParams.get("X-Amz-SignedHeaders")?.split(";") ?? [];
	const response = await fetch(ticket.url, { method: "PUT", headers: ticket.headers, body });

	// S3-ADP-2.1
	expect({
		dispositionHeader: ticket.headers["content-disposition"],
		signed: signedHeaders.includes("content-disposition"),
	}).toEqual({
		dispositionHeader: "attachment",
		signed: true,
	});
	// S3-ADP-2.2
	expect({
		status: response.status,
		disposition: fakeS3.objects.get(key)?.contentDisposition,
	}).toEqual({
		status: 200,
		disposition: "attachment",
	});
});

it("S3-ADP-3 이미 올라간 파일의 업로드 허가 주소로 다시 올릴 수 없고 원본 파일이 유지된다", async () => {
	const adapter = adapterOf();
	const key = randomUUID();
	const original = new Uint8Array(16).fill(1);
	const replacement = new Uint8Array(16).fill(9);
	const ticket = await adapter.ticket(key, { mime: "image/png", size: original.byteLength });
	await fetch(ticket.url, { method: "PUT", headers: ticket.headers, body: original });

	const second = await fetch(ticket.url, { method: "PUT", headers: ticket.headers, body: replacement });

	// S3-ADP-3.1
	expect(second.status).toBe(412);
	// S3-ADP-3.2
	expect(fakeS3.objects.get(key)?.bytes).toEqual(original);
});

it("S3-ADP-4 업로드 허가에 서명된 형식·크기·표시 헤더를 바꾸거나 빼고 올리면 거절되고 파일이 저장되지 않는다", async () => {
	const adapter = adapterOf();
	const key1 = randomUUID();
	const key2 = randomUUID();
	const key3 = randomUUID();
	const imgTicket1 = await adapter.ticket(key1, { mime: "image/png", size: 16 });
	const imgTicket2 = await adapter.ticket(key2, { mime: "image/png", size: 16 });
	const pdfTicket = await adapter.ticket(key3, { mime: "application/pdf", size: 20 });

	const wrongType = await fetch(imgTicket1.url, {
		method: "PUT",
		headers: { ...imgTicket1.headers, "content-type": "application/pdf" },
		body: new Uint8Array(16),
	});
	const wrongSize = await fetch(imgTicket2.url, {
		method: "PUT",
		headers: imgTicket2.headers,
		body: new Uint8Array(8),
	});
	const { "content-disposition": _, ...withoutDisposition } = pdfTicket.headers;
	const missingDisposition = await fetch(pdfTicket.url, {
		method: "PUT",
		headers: withoutDisposition,
		body: new Uint8Array(20),
	});

	// S3-ADP-4.1
	expect({ status: wrongType.status, stored: fakeS3.objects.has(key1) }).toEqual({ status: 403, stored: false });
	// S3-ADP-4.2
	expect({ status: wrongSize.status, stored: fakeS3.objects.has(key2) }).toEqual({ status: 403, stored: false });
	// S3-ADP-4.3
	expect({ status: missingDisposition.status, stored: fakeS3.objects.has(key3) }).toEqual({
		status: 403,
		stored: false,
	});
});

it("S3-ADP-5 허용되지 않은 파일 형식이나 최대 크기 초과 파일은 업로드 허가를 받을 수 없다", async () => {
	const adapter = adapterOf({ allowedMimeTypes: ["image/png"], maxSize: 1024 });

	// S3-ADP-5.1
	expect(await asyncCodeOf(adapter.ticket(randomUUID(), { mime: "image/jpeg", size: 100 }))).toBe("BAD_REQUEST");
	// S3-ADP-5.2
	expect(await asyncCodeOf(adapter.ticket(randomUUID(), { mime: "image/png", size: 1025 }))).toBe("BAD_REQUEST");
});

it("S3-ADP-6 버킷에 올라간 파일의 형식과 크기를 조회한다", async () => {
	const key = randomUUID();
	fakeS3.seed(key, { bytes: new Uint8Array(32), contentType: "image/webp" });

	// S3-ADP-6.1
	expect(await adapterOf().stat(key)).toEqual({ mime: "image/webp", size: 32 });
});

it("S3-ADP-7 버킷에 없는 파일을 조회하면 없음(null)을 돌려준다", async () => {
	// S3-ADP-7.1
	expect(await adapterOf().stat(randomUUID())).toBeNull();
});

it("S3-ADP-8 파일 조회 중 권한 오류가 나면 파일이 없다고 답하지 않고 오류를 던진다", async () => {
	fakeS3.headError = "AccessDenied";

	// S3-ADP-8.1
	await expect(adapterOf().stat(randomUUID())).rejects.toThrow();
});

it("S3-ADP-9 공개 기준 주소와 파일 키를 합친 읽기 주소를 돌려준다", () => {
	const key = "550e8400-e29b-41d4-a716-446655440000";

	// S3-ADP-9.1
	expect(adapterOf({ publicUrl: "https://cdn.example.com" }).url(key)).toBe(`https://cdn.example.com/${key}`);
});

it("S3-ADP-10 UUID가 아닌 파일 키로는 어떤 저장소 작업도 실행할 수 없다", async () => {
	const adapter = adapterOf();

	// S3-ADP-10.1
	expect(await asyncCodeOf(adapter.ticket("../secret", { mime: "image/png", size: 16 }))).toBe("BAD_REQUEST");
	// S3-ADP-10.2
	expect(await asyncCodeOf(adapter.stat("../secret"))).toBe("BAD_REQUEST");
	// S3-ADP-10.3
	expect(syncCodeOf(() => adapter.url("../secret"))).toBe("BAD_REQUEST");
	// S3-ADP-10.4
	expect(await asyncCodeOf(adapter.remove("../secret"))).toBe("BAD_REQUEST");
});

it("S3-ADP-11 버킷에 있는 파일을 삭제한다", async () => {
	const key = randomUUID();
	fakeS3.seed(key, { bytes: new Uint8Array(12), contentType: "image/png" });

	await adapterOf().remove(key);

	// S3-ADP-11.1
	expect(fakeS3.objects.has(key)).toBe(false);
});

it("S3-ADP-12 이미 없는 파일을 지워도 오류가 나지 않는다", async () => {
	const adapter = adapterOf();

	// S3-ADP-12.1
	await expect(adapter.remove(randomUUID())).resolves.toBeUndefined();

	fakeS3.deleteError = "NoSuchKey";
	// S3-ADP-12.2
	await expect(adapter.remove(randomUUID())).resolves.toBeUndefined();
});

it("S3-ADP-13 버킷이 없거나 삭제 권한 오류가 나면 성공으로 처리하지 않고 오류를 던진다", async () => {
	const adapter = adapterOf();

	fakeS3.deleteError = "NoSuchBucket";
	// S3-ADP-13.1
	await expect(adapter.remove(randomUUID())).rejects.toThrow();

	fakeS3.deleteError = "AccessDenied";
	// S3-ADP-13.2
	await expect(adapter.remove(randomUUID())).rejects.toThrow();
});
