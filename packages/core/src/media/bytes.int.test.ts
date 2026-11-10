import { describe, expect, it } from "vitest";
import { signedInApi } from "../__test__/admin";
import { testDatabase } from "../__test__/database";
import { createAdminApi } from "../entry/api";
import { createMonti, definePlugin } from "../monti";
import { defineSchema } from "../schema/define";
import { MAX_UPLOAD_BYTES } from "./accept";
import type { MediaItem } from "./operations";
import { memoryStorage } from "./storage";

const db = await testDatabase();
const schema = defineSchema({
	locales: { source: "ko", list: [{ code: "ko", name: "한국어" }], prefix: "never" },
	collections: {},
});
const storage = memoryStorage();
const monti = createMonti({ db, schema, plugins: [definePlugin({ name: "files", storage })] });
const api = signedInApi(monti);

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const PDF = new TextEncoder().encode("%PDF-1.7 body");

const put = (name: string, body: Uint8Array, to = api) =>
	to(
		new Request(`http://site/admin/api/media/bytes?name=${encodeURIComponent(name)}`, {
			method: "PUT",
			body: body.slice().buffer,
		}),
	);
const upload = async (name: string, body: Uint8Array) =>
	(await (await put(name, body)).json()) as { key: string; mime: string; size: number };
const get = (key: string) => createAdminApi(monti)(new Request(`http://site/admin/api/media/files/${key}`));

describe("bytes on their way up", () => {
	it("09-1 a file goes into the storage under a key the server made, and media.upload makes the item from it", async () => {
		const answer = await put("책상 사진.png", PNG);
		expect(answer.status).toBe(200);
		const { key, mime, size } = (await answer.json()) as { key: string; mime: string; size: number };
		expect(mime).toBe("image/png");
		expect(size).toBe(PNG.length);
		expect(key).toMatch(/^[0-9a-f-]{36}\.png$/);
		expect(await storage.stat(key)).toEqual({ size: PNG.length, mime: "image/png" });
		const made = (await monti.run(
			"media.upload",
			{ name: "책상 사진.png", original: { key, width: 1, height: 1 } },
			{ actor: "admin" },
		)) as {
			output: MediaItem;
		};
		expect(made.output.name).toBe("책상 사진.png");
	});

	it("09-1 without a session nothing goes up", async () => {
		const answer = await put("a.png", PNG, createAdminApi(monti));
		expect(answer.status).toBe(401);
		expect(await answer.json()).toEqual({ error: "unauthenticated" });
	});

	it("09-1 without a session the body is not even read: a file over the limit gets the same answer", async () => {
		const answer = await put("a.png", new Uint8Array(MAX_UPLOAD_BYTES + 1), createAdminApi(monti));
		expect(answer.status).toBe(401);
	});

	it("09-1 a storage that hands back a pooled Buffer serves its bytes and no others", async () => {
		const key = "00000000-0000-4000-8000-00000000abcd.txt";
		await storage.put(key, Buffer.from("hello"), { mime: "text/plain" });
		const answer = await get(key);
		expect(new TextDecoder().decode(await answer.arrayBuffer())).toBe("hello");
	});

	it("09-1 a file the library does not take is refused, whatever its name says", async () => {
		for (const [name, body] of [
			["setup.png", new Uint8Array([0x4d, 0x5a, 0x90, 0])],
			["page.html", new TextEncoder().encode("<script>alert(1)</script>")],
			["setup.exe", PNG],
		] as const) {
			const answer = await put(name, body);
			expect(answer.status).toBe(415);
			expect(await answer.json()).toEqual({ error: "media-refused", reason: { key: "media.badType" } });
		}
	});

	it("09-1 a file over the limit is refused, even one that does not declare its size", async () => {
		const over = new Uint8Array(MAX_UPLOAD_BYTES + 1);
		over.set(PNG);
		expect((await put("big.png", over)).status).toBe(413);
		const stream = new ReadableStream({
			start(controller) {
				controller.enqueue(over);
				controller.close();
			},
		});
		const undeclared = await api(
			new Request("http://site/admin/api/media/bytes?name=big.png", {
				method: "PUT",
				body: stream,
				duplex: "half",
			} as RequestInit),
		);
		expect(undeclared.status).toBe(413);
	});

	it("09-1 a site with no storage takes nothing", async () => {
		const bare = createMonti({ db, schema });
		const answer = await put("a.png", PNG, signedInApi(bare));
		expect(answer.status).toBe(422);
		expect(await answer.json()).toEqual({ error: "check-failed", reason: { key: "media.noStorage" } });
	});
});

describe("files on their way out", () => {
	it("09-1 a picture shows in place under its own type and can run nothing; a key that is not one finds nothing", async () => {
		const { key } = await upload("a.png", PNG);
		const answer = await get(key);
		expect(answer.status).toBe(200);
		expect(answer.headers.get("content-type")).toBe("image/png");
		expect(answer.headers.get("x-content-type-options")).toBe("nosniff");
		expect(answer.headers.get("content-security-policy")).toBe("sandbox");
		expect(answer.headers.get("content-disposition")).toBeNull();
		expect(new Uint8Array(await answer.arrayBuffer())).toEqual(PNG);
		expect((await get("..%2F..%2Fetc%2Fpasswd")).status).toBe(404);
		expect((await get("00000000-0000-4000-8000-000000000000.png")).status).toBe(404);
	});

	it("09-1 any other file comes down under the name it has in the library", async () => {
		const { key } = await upload("가격표.pdf", PDF);
		await monti.run("media.upload", { name: "가격표.pdf", original: { key } }, { actor: "admin" });
		const answer = await get(key);
		expect(answer.headers.get("content-disposition")).toBe(
			`attachment; filename*=UTF-8''${encodeURIComponent("가격표.pdf")}`,
		);
	});
});
