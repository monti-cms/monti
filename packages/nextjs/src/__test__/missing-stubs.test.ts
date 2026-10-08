import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { MISSING_OPTIONAL_MODULE, missingStubs } from "../config";

let dirs: string[] = [];
afterEach(() => {
	for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
	dirs = [];
});
const folder = () => {
	const dir = mkdtempSync(path.join(tmpdir(), "monti-stubs-"));
	dirs.push(dir);
	return dir;
};

describe("the stand-in for a package that is not installed", () => {
	it("is a file of its own for each package, and loading it names the package to install", () => {
		const root = folder();
		const stubs = missingStubs(root, ["recharts", "@scope/pkg"]);
		expect(Object.keys(stubs)).toEqual(["recharts", "@scope/pkg"]);
		for (const [name, relative] of Object.entries(stubs)) {
			expect(relative.startsWith("./node_modules/")).toBe(true);
			const file = path.join(root, relative);
			expect(existsSync(file)).toBe(true);
			expect(() => createRequire(import.meta.url)(file)).toThrow(
				new RegExp(`package "${name}" is not installed.*add ${name}`),
			);
		}
		// A build that cannot find an export names the file, so the file name says what is missing.
		expect(stubs.recharts).toMatch(/\/recharts-not-installed\.cjs$/);
		expect(readFileSync(path.join(root, stubs.recharts as string), "utf8")).not.toContain("@scope/pkg");
	});

	it("falls back to the shared stub when the file cannot be written", () => {
		const root = folder();
		// A file where the cache folder should be.
		mkdirSync(path.join(root, "node_modules"));
		writeFileSync(path.join(root, "node_modules/.cache"), "");
		expect(missingStubs(root, ["recharts"])).toEqual({ recharts: MISSING_OPTIONAL_MODULE });
	});
});
