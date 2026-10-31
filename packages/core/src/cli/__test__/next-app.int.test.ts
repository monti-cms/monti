import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { findRootLayout } from "../next-app";

let dirs: string[] = [];
afterEach(() => {
	for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
	dirs = [];
});

function app(files: Record<string, string>): string {
	const dir = mkdtempSync(path.join(tmpdir(), "monti-first-run-"));
	dirs.push(dir);
	for (const [file, content] of Object.entries({ "package.json": "{}", ...files })) {
		mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
		writeFileSync(path.join(dir, file), content);
	}
	return dir;
}

describe("suppressHydrationWarning on <html>", () => {
	it("finds the root layout under app or src/app", () => {
		expect(findRootLayout(app({ "app/layout.tsx": "" }))).toBe("app/layout.tsx");
		expect(findRootLayout(app({ "src/app/layout.jsx": "", "app/layout.tsx": "" }))).toBe("src/app/layout.jsx");
		expect(findRootLayout(app({}))).toBeUndefined();
	});
});
