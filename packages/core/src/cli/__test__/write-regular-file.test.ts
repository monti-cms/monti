import {
	existsSync,
	lstatSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const modulePath = fileURLToPath(new URL("../../../../../scripts/write-regular-file.mjs", import.meta.url));
const load = async () =>
	(await import(/* @vite-ignore */ modulePath)) as { writeRegularFile(file: string, content: string): boolean };

let dirs: string[] = [];
afterEach(() => {
	for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
	dirs = [];
});
const temp = () => {
	const dir = mkdtempSync(path.join(tmpdir(), "monti-write-"));
	dirs.push(dir);
	return dir;
};

describe("preview script file writes", () => {
	it("replaces a symlink with a regular file and leaves the link's target alone", async () => {
		const { writeRegularFile } = await load();
		const dir = temp();
		const target = path.join(dir, "real.env");
		writeFileSync(target, "KEEP=me\n");
		const file = path.join(dir, "app", ".env.local");
		mkdirSync(path.dirname(file));
		symlinkSync(target, file);

		expect(writeRegularFile(file, "NEW=1\n")).toBe(true);
		expect(lstatSync(file).isSymbolicLink()).toBe(false);
		expect(readFileSync(file, "utf8")).toBe("NEW=1\n");
		expect(readFileSync(target, "utf8")).toBe("KEEP=me\n");
	});

	it("replaces a dangling symlink without creating its target", async () => {
		const { writeRegularFile } = await load();
		const dir = temp();
		const target = path.join(dir, "missing.env");
		const file = path.join(dir, ".env.local");
		symlinkSync(target, file);
		expect(writeRegularFile(file, "A=1\n")).toBe(true);
		expect(existsSync(target)).toBe(false);
		expect(readFileSync(file, "utf8")).toBe("A=1\n");
	});

	it("writes a new file and overwrites a regular one, reporting no replaced link", async () => {
		const { writeRegularFile } = await load();
		const file = path.join(temp(), ".env.local");
		expect(writeRegularFile(file, "A=1\n")).toBe(false);
		expect(writeRegularFile(file, "A=2\n")).toBe(false);
		expect(readFileSync(file, "utf8")).toBe("A=2\n");
	});
});
