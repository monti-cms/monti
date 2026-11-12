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

/**
 * A storage a browser sends files straight to: its address is signed for one key, type and size. What the "browser" sends to that address
 * is `files.put` with the ticket's key.
 */
const files = memoryStorage();
const signed = vi.fn(async (key: string, file: { mime: string; size: number }) => ({
	url: `https://bucket.test/${key}?signed=${file.size}`,
	headers: { "content-type": file.mime },
}));
const storage: Storage = { ...files, ticket: signed };
const monti = createMonti({ db, schema, plugins: [definePlugin({ name: "files", storage })] });
const api = signedInApi(monti);

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
/** A picture of the same length as `PNG`, and other bytes. */
const OTHER = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 9, 9, 9]);
const PDF = new TextEncoder().encode("%PDF-1.7 body");
const base64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));

const post = (route: "ticket" | "sealed", body: unknown, to = api) =>
	to(new Request(`http://site/admin/api/media/${route}`, { method: "POST", body: JSON.stringify(body) }));
const ticket = async (name: string, bytes: Uint8Array, size = bytes.length, to = api) => {
	const answer = await post("ticket", { name, size, head: base64(bytes.subarray(0, 4096)) }, to);
	return {
		status: answer.status,
		body: (await answer.json()) as { direct?: boolean; key: string; url: string; headers: Record<string, string> },
	};
};
const sealed = async (key: string, to = api) => {
	const answer = await post("sealed", { key }, to);
	return { status: answer.status, body: (await answer.json()) as { key: string; mime: string; size: number } };
};
const loose = (key: string) =>
	db.selectFrom("loose_files").select(["sealed", "ticket_size"]).where("key", "=", key).executeTakeFirst();
const upload = (key: string, name = "desk.png", on = monti) =>
	on.run("media.upload", { name, original: { key, width: 1, height: 1 } }, { actor: "admin" }) as Promise<{
		output: MediaItem;
	}>;
/** A ticket, the file sent to its address, and the seal: the key the server answers with. */
async function sent(bytes: Uint8Array, name = "desk.png", mime = "image/png") {
	const { key } = (await ticket(name, bytes)).body;
	await files.put(key, bytes, { mime });
	return { ticketed: key, sealed: (await sealed(key)).body.key };
}
const LATER = () => new Date(monti.now().getTime() + 3 * 24 * 3_600_000);

describe("the direct way up", () => {
	it("20-11 a ticket, the file sent straight to the storage, then sealed: the checked file is under a key of the server's own, and media.upload makes the item from it", async () => {
		const { status, body } = await ticket("desk.png", PNG);
		expect(status).toBe(200);
		expect(body).toEqual({
			direct: true,
			key: expect.stringMatching(/^[0-9a-f-]{36}\.png$/),
			url: `https://bucket.test/${body.key}?signed=${PNG.length}`,
			headers: { "content-type": "image/png" },
		});
		// The address is signed for the server's key, the type the bytes say, and the size; the row keeps that size.
		expect(signed).toHaveBeenLastCalledWith(body.key, { mime: "image/png", size: PNG.length });
		expect(await loose(body.key)).toEqual({ sealed: false, ticket_size: PNG.length });
		// Nothing went through the site.
		expect(await files.stat(body.key)).toBeNull();

		await files.put(body.key, PNG, { mime: "image/png" });
		const answer = await sealed(body.key);
		expect(answer).toEqual({
			status: 200,
			body: { key: expect.stringMatching(/^[0-9a-f-]{36}\.png$/), mime: "image/png", size: PNG.length },
		});
		// A key no address was ever signed for holds the file; the one the browser wrote to holds nothing.
		expect(answer.body.key).not.toBe(body.key);
		expect(signed).not.toHaveBeenCalledWith(answer.body.key, expect.anything());
		expect((await files.read(answer.body.key))?.bytes).toEqual(PNG);
		expect(await files.stat(body.key)).toBeNull();
		expect(await loose(answer.body.key)).toEqual({ sealed: true, ticket_size: null });

		const made = await upload(answer.body.key);
		expect(made.output.name).toBe("desk.png");
		expect(await loose(answer.body.key)).toBeUndefined();
	});

	it("20-12 a key that was never sealed makes no item: not the ticket's key with a file behind it, not a key written straight into the storage", async () => {
		// The steps of the review: a ticket for a picture, any bytes sent to its address, and media.upload without the seal.
		const { key } = (await ticket("a.png", PNG)).body;
		await files.put(key, PDF, { mime: "image/png" });
		await expect(upload(key)).rejects.toMatchObject({ reason: { key: "media.unknownKey" } });
		// The same after the key's own seal: it is the copy that is sealed.
		await files.put(key, PNG, { mime: "image/png" });
		const copy = (await sealed(key)).body.key;
		await files.put(key, PNG, { mime: "image/png" });
		await expect(upload(key)).rejects.toMatchObject({ reason: { key: "media.unknownKey" } });

		const stray = "00000000-0000-4000-8000-00000000d1ec.png";
		await files.put(stray, PNG, { mime: "image/png" });
		await expect(upload(stray)).rejects.toMatchObject({ reason: { key: "media.unknownKey" } });
		expect((await upload(copy)).output.name).toBe("desk.png");
	});

	it("20-12 the signed address still works after the seal, and what is sent to it changes nothing an item reads; the clean-up removes it", async () => {
		const { ticketed, sealed: key } = await sent(PNG);
		await upload(key);
		// The address is good for minutes yet: other bytes of the same length go to the same key.
		await files.put(ticketed, OTHER, { mime: "image/png" });
		expect((await files.read(key))?.bytes).toEqual(PNG);
		// It cannot be sealed a second time, and nothing names it: it goes with the clean-up.
		expect((await sealed(ticketed)).status).toBe(404);
		await sweepLooseFiles(db, storage, LATER());
		expect(await files.stat(ticketed)).toBeNull();
		expect((await files.read(key))?.bytes).toEqual(PNG);
	});

	it("20-12 what is checked is the copy: bytes changed between the look and the copy are caught, and both keys are emptied", async () => {
		const { key } = (await ticket("a.png", PNG)).body;
		await files.put(key, PNG, { mime: "image/png" });
		// The browser writes again the moment the server has looked at the file.
		const stat = vi.spyOn(storage, "stat").mockImplementationOnce(async (asked) => {
			const found = await files.stat(asked);
			await files.put(key, new Uint8Array([...PDF.subarray(0, PNG.length)]), { mime: "image/png" });
			return found;
		});
		const put = vi.spyOn(storage, "put");
		const answer = await sealed(key);
		stat.mockRestore();
		expect(answer.status).toBe(415);
		const copy = put.mock.calls.map(([to]) => to).find((to) => to !== key);
		put.mockRestore();
		expect(copy).toBeDefined();
		expect(await files.stat(copy as string)).toBeNull();
		expect(await files.stat(key)).toBeNull();
		expect(await loose(copy as string)).toBeUndefined();
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

	it("20-12 a file the library does not take gets no ticket: its first bytes and its size answer, as on the byte route; a body that is not one is a 400", async () => {
		signed.mockClear();
		expect((await ticket("page.html", new TextEncoder().encode("<script>alert(1)</script>"))).status).toBe(415);
		expect((await ticket("setup.png", new Uint8Array([0x4d, 0x5a, 0x90, 0]))).status).toBe(415);
		expect((await ticket("big.png", PNG, MAX_UPLOAD_BYTES + 1)).status).toBe(413);
		expect(signed).not.toHaveBeenCalled();
		expect((await post("ticket", { name: "a.png" })).status).toBe(400);
		// First bytes that are not base64: the body is refused, the server does not fail.
		for (const head of ["not base64!", "abc", "####"])
			expect((await post("ticket", { name: "a.png", size: 3, head })).status).toBe(400);
		expect((await post("sealed", { key: 7 })).status).toBe(400);
	});

	it("20-12 what is in the storage is what counts: a file of another kind, under another type, of another size or over the limit is removed and refused", async () => {
		// The browser showed a picture's first bytes and sent something else.
		const other = (await ticket("a.png", PNG)).body.key;
		await files.put(other, new Uint8Array([...PDF.subarray(0, PNG.length)]), { mime: "image/png" });
		expect(await sealed(other)).toEqual({
			status: 415,
			body: { error: "media-refused", reason: { key: "media.badType" } },
		});
		expect(await files.stat(other)).toBeNull();
		// Its row stays until its time: the address may be written to again, and that is cleaned up too.
		expect(await loose(other)).toEqual({ sealed: false, ticket_size: null });

		// Stored under a type its bytes are not.
		const mislabelled = (await ticket("a.png", PNG)).body.key;
		await files.put(mislabelled, PNG, { mime: "text/html" });
		expect((await sealed(mislabelled)).status).toBe(415);
		expect(await files.stat(mislabelled)).toBeNull();

		// A picture, within the limit, but not of the size the address was signed for: the storage let something else through.
		const longer = (await ticket("a.png", PNG)).body.key;
		await files.put(longer, new Uint8Array([...PNG, 4]), { mime: "image/png" });
		expect((await sealed(longer)).status).toBe(409);
		expect(await files.stat(longer)).toBeNull();

		// Past the limit: refused by its stored size, before a byte of it is copied or read.
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

	it("20-12 only a key the server signed an address for is sealed, once its file is there; a file never sealed is removed by the clean-up", async () => {
		// A key of the right shape that no ticket made.
		const stray = "00000000-0000-4000-8000-00000000d1ed.png";
		await files.put(stray, PNG, { mime: "image/png" });
		expect((await sealed(stray)).status).toBe(404);
		expect(await files.stat(stray)).not.toBeNull();
		expect((await sealed("../../etc/passwd")).status).toBe(404);
		// Nor the seal's own answer: a sealed key is not a ticket.
		const done = await sent(PNG);
		expect((await sealed(done.sealed)).status).toBe(404);

		const { key } = (await ticket("a.png", PNG)).body;
		// Sealed before the file went up: the ticket is still good once it has.
		expect((await sealed(key)).status).toBe(404);
		await files.put(key, PNG, { mime: "image/png" });
		await sweepLooseFiles(db, storage, LATER());
		expect(await files.stat(key)).toBeNull();
		expect(await files.stat(done.sealed)).toBeNull();
	});

	it("20-11 a storage that copies inside itself and reads a file's start is asked for just that: no file comes through the server", async () => {
		const start = vi.fn(
			async (key: string, length: number) => (await files.read(key))?.bytes.subarray(0, length) ?? null,
		);
		const copy = vi.fn(async (from: string, to: string) => {
			const file = await files.read(from);
			if (file) await files.put(to, file.bytes, { mime: file.mime });
		});
		const whole = vi.fn(storage.read);
		const inside = createMonti({
			db,
			schema,
			plugins: [definePlugin({ name: "files", storage: { ...storage, read: whole, readStart: start, copy } })],
		});
		const to = signedInApi(inside);
		const { key } = (await ticket("a.pdf", PDF, PDF.length, to)).body;
		await files.put(key, PDF, { mime: "application/pdf" });
		copy.mockClear();
		const done = await sealed(key, to);
		expect(done.body).toEqual({ key: expect.any(String), mime: "application/pdf", size: PDF.length });
		expect(copy).toHaveBeenCalledWith(key, done.body.key);
		expect(start).toHaveBeenCalledWith(done.body.key, 4096);
		expect(whole).not.toHaveBeenCalled();
	});

	it("20-13 the byte route is as it was: on a storage with no direct upload, and on one with it, where the key it gives is sealed", async () => {
		const bytes = (to: typeof api) =>
			to(new Request("http://site/admin/api/media/bytes?name=a.png", { method: "PUT", body: PNG.slice().buffer }));
		const plainFiles = memoryStorage();
		const plain = createMonti({ db, schema, plugins: [definePlugin({ name: "files", storage: plainFiles })] });
		const to = signedInApi(plain);
		const answer = await post("ticket", { name: "a.png", size: PNG.length, head: base64(PNG) }, to);
		expect(answer.status).toBe(200);
		expect(await answer.json()).toEqual({ direct: false });
		const up = await bytes(to);
		expect(up.status).toBe(200);
		const { key } = (await up.json()) as { key: string };
		expect((await upload(key, "a.png", plain)).output.name).toBe("a.png");
		// A storage with no direct upload takes a key by its file, as before.
		const direct = "00000000-0000-4000-8000-00000000d1ee.png";
		await plainFiles.put(direct, PNG, { mime: "image/png" });
		expect((await upload(direct, "b.png", plain)).output.name).toBe("b.png");

		// The server read these bytes itself: the key is sealed, and makes an item.
		const through = (await (await bytes(api)).json()) as { key: string };
		expect(await loose(through.key)).toEqual({ sealed: true, ticket_size: null });
		expect((await upload(through.key, "c.png")).output.name).toBe("c.png");

		const bare = createMonti({ db, schema });
		const none = await post("ticket", { name: "a.png", size: PNG.length, head: base64(PNG) }, signedInApi(bare));
		expect(none.status).toBe(422);
	});
});
