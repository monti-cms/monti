import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { unzip, zip } from "./zip";

const text = (value: string) => new TextEncoder().encode(value);

describe("the backup's zip", () => {
	const files = [
		{ name: "manifest.json", bytes: text('{"format":1}') },
		{ name: "entries.jsonl", bytes: text(`${"한 줄의 글 ".repeat(400)}\n`) },
		{ name: "media/사진 one.png", bytes: new Uint8Array([137, 80, 78, 71, 0, 1, 2, 3, 255]) },
		{ name: "empty.txt", bytes: new Uint8Array() },
	];

	it("14-1 what is written is read back, file for file, and text is packed smaller", async () => {
		const packed = await zip(files);
		expect(packed.length).toBeLessThan(files[1].bytes.length);
		const read = unzip(packed);
		expect(read?.names).toEqual(files.map((file) => file.name));
		for (const file of files) expect(await read?.read(file.name)).toEqual(file.bytes);
		expect(await read?.read("nowhere")).toBeNull();
		// The same files make the same bytes: nothing of the moment is written in.
		expect(await zip(files)).toEqual(packed);
	});

	it("14-1 the system's own unzip reads it", async () => {
		const dir = mkdtempSync(path.join(tmpdir(), "monti-zip-"));
		try {
			// Plain names here: how a system's unzip writes a name outside ASCII to disk is its own business, not the archive's.
			const plain = files.map((file) => ({ ...file, name: file.name.replace("사진 one", "photo") }));
			writeFileSync(path.join(dir, "backup.zip"), await zip(plain));
			execFileSync("unzip", ["-q", "backup.zip", "-d", "out"], { cwd: dir });
			expect(readFileSync(path.join(dir, "out", "entries.jsonl"))).toEqual(Buffer.from(files[1].bytes));
			expect(readFileSync(path.join(dir, "out", "media", "photo.png"))).toEqual(Buffer.from(files[2].bytes));
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("14-1 bytes that are no zip are said to be none", () => {
		expect(unzip(text("not a zip at all, only words"))).toBeNull();
		expect(unzip(new Uint8Array())).toBeNull();
	});

	it("14-1 a packed file that is cut short, or unpacks to more than it says, reads as nothing and breaks nothing", async () => {
		const whole = await zip([{ name: "entries.jsonl", bytes: text("a line of words ".repeat(400)) }]);
		// The size the list at the end gives for the file, made smaller than what it unpacks to.
		const lying = whole.slice();
		const view = new DataView(lying.buffer);
		let central = -1;
		for (let at = lying.length - 4; at >= 0 && central < 0; at--)
			if (view.getUint32(at, true) === 0x02014b50) central = at;
		view.setUint32(central + 24, 10, true);
		expect(await unzip(lying)?.read("entries.jsonl")).toBeNull();
		// Its packed bytes spoiled.
		const broken = whole.slice();
		broken.fill(0xff, 60, 90);
		expect(await unzip(broken)?.read("entries.jsonl")).toBeNull();
	});
});
