import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { localFolderStorage } from "./local-storage";

const dir = await mkdtemp(path.join(tmpdir(), "monti-media-"));
afterAll(() => rm(dir, { recursive: true, force: true }));

const KEY = "3f2a1c9e-1111-4222-8333-444455556666.png";

describe("localFolderStorage", () => {
	it("09-1 keeps a file's bytes and type under its key, until it is removed", async () => {
		const storage = localFolderStorage({ dir: path.join(dir, "made-on-first-put") });
		const bytes = new Uint8Array([1, 2, 3]);
		expect(await storage.stat(KEY)).toBeNull();
		await storage.put(KEY, bytes, { mime: "image/png" });
		expect(await storage.stat(KEY)).toEqual({ size: 3, mime: "image/png" });
		const read = await storage.read(KEY);
		expect(read?.mime).toBe("image/png");
		expect([...(read?.bytes ?? [])]).toEqual([1, 2, 3]);
		await storage.remove(KEY);
		expect(await storage.read(KEY)).toBeNull();
	});

	it("09-1 a key that would walk out of the folder is refused and writes nothing", async () => {
		const inner = await mkdtemp(path.join(dir, "inner-"));
		const storage = localFolderStorage({ dir: inner });
		await expect(storage.put("../outside.png", new Uint8Array([1]), { mime: "image/png" })).rejects.toThrow(
			/media key/,
		);
		await expect(storage.read("../../etc/passwd")).rejects.toThrow(/media key/);
		expect(await readdir(dir)).not.toContain("outside.png");
	});

	it("09-1 a file's address is under the admin API it is served from", () => {
		expect(localFolderStorage({ dir, base: "/cms/api" }).url(KEY)).toBe(`/cms/api/media/files/${KEY}`);
	});
});
