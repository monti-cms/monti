import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
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

	/** A one-file zip as an older tool writes it: the name's bytes replaced, and no word that names are UTF-8. */
	const legacy = async (nameBytes: number[]) => {
		const made = await zip([{ name: "A".repeat(nameBytes.length), bytes: new Uint8Array([1, 2, 3]) }]);
		const view = new DataView(made.buffer, made.byteOffset, made.byteLength);
		let central = -1;
		for (let at = 0; at + 4 <= made.length; at++) {
			const signature = view.getUint32(at, true);
			if (signature === 0x04034b50) {
				view.setUint16(at + 6, 0, true);
				made.set(nameBytes, at + 30);
			}
			if (signature === 0x02014b50) {
				central = at;
				view.setUint16(at + 8, 0, true);
				made.set(nameBytes, at + 46);
			}
		}
		return { made, central };
	};
	const CP949 = [0xbb, 0xe7, 0xc1, 0xf8, 0x2e, 0x70, 0x6e, 0x67]; // "사진.png"

	it("14-1 a name not said to be UTF-8 is read as UTF-8 when it is, as CP949 when it is not, and still opens where the runtime has no CP949", async () => {
		expect(unzip((await legacy(CP949)).made)?.names).toEqual(["사진.png"]);
		expect(unzip((await legacy([...new TextEncoder().encode("그림.png")])).made)?.names).toEqual(["그림.png"]);
		const Real = globalThis.TextDecoder;
		vi.stubGlobal(
			"TextDecoder",
			class extends Real {
				constructor(label?: string, options?: ConstructorParameters<typeof Real>[1]) {
					if (label === "euc-kr") throw new RangeError("no such encoding");
					super(label, options);
				}
			},
		);
		try {
			const opened = unzip((await legacy(CP949)).made);
			expect(opened?.names).toHaveLength(1);
			expect(opened?.names[0]).toMatch(/\.png$/);
			expect(await opened?.read(opened.names[0] as string)).toEqual(new Uint8Array([1, 2, 3]));
		} finally {
			vi.unstubAllGlobals();
		}
	});

	it("14-1 a Unicode path beside a name in an old encoding is the name, when it carries that name's sum", async () => {
		const withPath = async (sumOf: (name: Uint8Array) => number) => {
			const { made, central } = await legacy(CP949);
			const path = new TextEncoder().encode("그림 하나.png");
			const extra = new Uint8Array(9 + path.length);
			const field = new DataView(extra.buffer);
			field.setUint16(0, 0x7075, true);
			field.setUint16(2, 5 + path.length, true);
			extra[4] = 1;
			field.setUint32(5, sumOf(new Uint8Array(CP949)), true);
			extra.set(path, 9);
			// The field goes after the name in the list at the end; the list is that much longer.
			const at = central + 46 + CP949.length;
			const whole = new Uint8Array(made.length + extra.length);
			whole.set(made.subarray(0, at));
			whole.set(extra, at);
			whole.set(made.subarray(at), at + extra.length);
			const view = new DataView(whole.buffer);
			view.setUint16(central + 30, extra.length, true);
			const end = whole.length - 22;
			view.setUint32(end + 12, view.getUint32(end + 12, true) + extra.length, true);
			return unzip(whole);
		};
		// The sum of the name it stands beside: CRC-32, as the zip keeps of every file (read here from a zip of those bytes).
		const sum = async (name: Uint8Array) => {
			const probe = await zip([{ name: "x.png", bytes: name }]);
			return new DataView(probe.buffer, probe.byteOffset).getUint32(14, true);
		};
		const right = await sum(new Uint8Array(CP949));
		const opened = await withPath(() => right);
		expect(opened?.names).toEqual(["그림 하나.png"]);
		expect(await opened?.read("그림 하나.png")).toEqual(new Uint8Array([1, 2, 3]));
		// A path that is of another name is not this file's: the name's own bytes are read.
		expect((await withPath(() => right + 1))?.names).toEqual(["사진.png"]);
	});
});
