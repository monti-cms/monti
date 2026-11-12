import { describe, expect, it, vi } from "vitest";
import { signedInApi } from "../__test__/admin";
import { testDatabase } from "../__test__/database";
import { createAdminApi } from "../entry/api";
import { createMonti, definePlugin } from "../monti";
import { defineSchema } from "../schema/define";
import { sweepLooseFiles } from "../trash/purge";
import { MAX_UPLOAD_BYTES } from "./accept";
import type { MediaItem } from "./operations";
import { memoryStorage, type Storage } from "./storage";

const db = await testDatabase();
const schema = defineSchema({
	locales: { source: "en", list: [{ code: "en", name: "English" }], prefix: "never" },
	collections: {},
});

/** A storage a browser sends files straight to: its address is signed for one key, type and size. What the "browser" puts is `files.put`. */
const files = memoryStorage();
const signed = vi.fn(async (key: string, file: { mime: string; size: number }) => ({
	url: `https://bucket.test/${key}?signed=${file.size}`,
	headers: { "content-type": file.mime },
}));
const storage: Storage = { ...files, ticket: signed };
const monti = createMonti({ db, schema, plugins: [definePlugin({ name: "files", storage })] });
const api = signedInApi(monti);

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const PDF = new TextEncoder().encode("%PDF-1.7 body");
const base64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));

const post = (route: "ticket" | "sealed", body: unknown, to = api) =>
	to(new Request(`http://site/admin/api/media/${route}`, { method: "POST", body: JSON.stringify(body) }));
const ticket = async (name: string, bytes: Uint8Array, size = bytes.length) => {
	const answer = await post("ticket", { name, size, head: base64(bytes.subarray(0, 4096)) });
	return {
		status: answer.status,
		body: (await answer.json()) as { direct?: boolean; key: string; url: string; headers: Record<string, string> },
	};
};
const sealed = async (key: string) => {
	const answer = await post("sealed", { key });
	return { status: answer.status, body: await answer.json() };
};
const loose = async (key: string) =>
	(await db.selectFrom("loose_files").select("key").where("key", "=", key).executeTakeFirst()) !== undefined;

describe("the direct way up", () => {
	it("20-11 a ticket, the file sent straight to the storage, then sealed: the answer is the byte route's, and media.upload makes the item", async () => {
		const { status, body } = await ticket("desk.png", PNG);
		expect(status).toBe(200);
		expect(body).toEqual({
			direct: true,
			key: expect.stringMatching(/^[0-9a-f-]{36}\.png$/),
			url: `https://bucket.test/${body.key}?signed=${PNG.length}`,
			headers: { "content-type": "image/png" },
		});
		// The address is signed for the server's key, the type the bytes say, and the size.
		expect(signed).toHaveBeenLastCalledWith(body.key, { mime: "image/png", size: PNG.length });
		// Nothing went through the site.
		expect(await files.stat(body.key)).toBeNull();

		await files.put(body.key, PNG, { mime: "image/png" });
		expect(await sealed(body.key)).toEqual({
			status: 200,
			body: { key: body.key, mime: "image/png", size: PNG.length },
		});
		const made = (await monti.run(
			"media.upload",
			{ name: "desk.png", original: { key: body.key, width: 1, height: 1 } },
			{ actor: "admin" },
		)) as { output: MediaItem };
		expect(made.output.name).toBe("desk.png");
		expect(await loose(body.key)).toBe(false);
	});

	it("20-12 without a session there is no ticket and nothing is sealed", async () => {
		signed.mockClear();
		const open = createAdminApi(monti);
		const refused = await post("ticket", { name: "a.png", size: PNG.length, head: base64(PNG) }, open);
		expect(refused.status).toBe(401);
		expect(signed).not.toHaveBeenCalled();
		const { body } = await ticket("a.png", PNG);
		await files.put(body.key, PNG, { mime: "image/png" });
		expect((await post("sealed", { key: body.key }, open)).status).toBe(401);
	});

	it("20-12 a file the library does not take gets no ticket: its first bytes and its size answer, as on the byte route", async () => {
		signed.mockClear();
		expect((await ticket("page.html", new TextEncoder().encode("<script>alert(1)</script>"))).status).toBe(415);
		expect((await ticket("setup.png", new Uint8Array([0x4d, 0x5a, 0x90, 0]))).status).toBe(415);
		expect((await ticket("big.png", PNG, MAX_UPLOAD_BYTES + 1)).status).toBe(413);
		expect(signed).not.toHaveBeenCalled();
		expect((await post("ticket", { name: "a.png" })).status).toBe(400);
	});

	it("20-12 what is in the storage is what counts: a file of another kind, under another type or over the limit is removed and refused", async () => {
		// The browser showed a picture's first bytes and sent something else.
		const other = (await ticket("a.png", PNG)).body.key;
		await files.put(other, PDF, { mime: "image/png" });
		expect(await sealed(other)).toEqual({
			status: 415,
			body: { error: "media-refused", reason: { key: "media.badType" } },
		});
		expect(await files.stat(other)).toBeNull();
		expect(await loose(other)).toBe(false);

		// Stored under a type its bytes are not.
		const mislabelled = (await ticket("a.png", PNG)).body.key;
		await files.put(mislabelled, PNG, { mime: "text/html" });
		expect((await sealed(mislabelled)).status).toBe(415);
		expect(await files.stat(mislabelled)).toBeNull();

		// Larger than it said, past the limit: refused by its stored size, before a byte of it is read.
		const big = (await ticket("a.png", PNG)).body.key;
		const over = new Uint8Array(MAX_UPLOAD_BYTES + 1);
		over.set(PNG);
		await files.put(big, over, { mime: "image/png" });
		const read = vi.spyOn(storage, "read");
		expect((await sealed(big)).status).toBe(413);
		expect(read).not.toHaveBeenCalled();
		read.mockRestore();
		expect(await files.stat(big)).toBeNull();
	});

	it("20-12 only a key the server handed out is sealed, once its file is there; a file never sealed is removed by the clean-up", async () => {
		// A key of the right shape that no ticket made.
		const stray = "00000000-0000-4000-8000-00000000d1ec.png";
		await files.put(stray, PNG, { mime: "image/png" });
		expect((await sealed(stray)).status).toBe(404);
		expect(await files.stat(stray)).not.toBeNull();
		expect((await sealed("../../etc/passwd")).status).toBe(404);

		const { key } = (await ticket("a.png", PNG)).body;
		// Sealed before the file went up.
		expect((await sealed(key)).status).toBe(404);
		await files.put(key, PNG, { mime: "image/png" });
		expect(await loose(key)).toBe(true);
		const later = new Date(monti.now().getTime() + 3 * 24 * 3_600_000);
		await sweepLooseFiles(db, storage, later);
		expect(await files.stat(key)).toBeNull();
	});

	it("20-11 a storage that reads a file's start is asked for just that, not the whole file", async () => {
		const start = vi.fn(
			async (key: string, length: number) => (await files.read(key))?.bytes.subarray(0, length) ?? null,
		);
		const ranged = createMonti({
			db,
			schema,
			plugins: [definePlugin({ name: "files", storage: { ...storage, readStart: start } })],
		});
		const read = vi.spyOn(files, "read");
		const to = signedInApi(ranged);
		const answer = await post("ticket", { name: "a.pdf", size: PDF.length, head: base64(PDF) }, to);
		const { key } = (await answer.json()) as { key: string };
		await files.put(key, PDF, { mime: "application/pdf" });
		read.mockClear();
		const done = await post("sealed", { key }, to);
		expect(await done.json()).toEqual({ key, mime: "application/pdf", size: PDF.length });
		expect(start).toHaveBeenCalledWith(key, 4096);
		read.mockRestore();
	});

	it("20-13 a storage that takes no direct uploads says so, and the file goes up the byte route as before", async () => {
		const plain = createMonti({ db, schema, plugins: [definePlugin({ name: "files", storage: memoryStorage() })] });
		const to = signedInApi(plain);
		const answer = await post("ticket", { name: "a.png", size: PNG.length, head: base64(PNG) }, to);
		expect(answer.status).toBe(200);
		expect(await answer.json()).toEqual({ direct: false });
		const up = await to(
			new Request("http://site/admin/api/media/bytes?name=a.png", { method: "PUT", body: PNG.slice().buffer }),
		);
		expect(up.status).toBe(200);

		const bare = createMonti({ db, schema });
		const none = await post("ticket", { name: "a.png", size: PNG.length, head: base64(PNG) }, signedInApi(bare));
		expect(none.status).toBe(422);
	});
});
