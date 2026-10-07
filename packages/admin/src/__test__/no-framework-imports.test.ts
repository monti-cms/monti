import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The admin is framework-neutral: it reaches the router through the injected `AdminRouter` (`src/router`) and the server through `AdminServer`
 * (`src/host/server.ts`), and imports nothing from Next.js, whatever the file (a screen, a hook, a plugin point or the layout).
 * What is Next-specific lives in `@monti-cms/nextjs`.
 */

const SRC = path.resolve(import.meta.dirname, "..");

/** The modules the admin may not import: Next.js itself, its auth library, and the package that adapts the admin to it. */
const FORBIDDEN = /^(next|next-auth|@auth\/core|@monti-cms\/nextjs)(\/|$)/;

const code = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

function importsOf(source: string): string[] {
	const patterns = [
		/\b(?:import|export)\s+(?:type\s+)?[^"';]*?\sfrom\s*["']([^"']+)["']/g,
		/\bimport\s*["']([^"']+)["']/g,
		/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
		/\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
		/\bimport\s+type\s*\(\s*["']([^"']+)["']\s*\)/g,
	];
	const specifiers = new Set<string>();
	for (const pattern of patterns)
		for (const match of code(source).matchAll(pattern)) specifiers.add(match[1] as string);
	return [...specifiers];
}

/** The source files (tests and test helpers left out) under `dir`. */
function sourcesUnder(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory())
			return entry.name === "__test__" || full === path.join(SRC, "test") ? [] : sourcesUnder(full);
		return /\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : [];
	});
}

const violationsIn = (files: string[], root: string) =>
	files.flatMap((file) =>
		importsOf(readFileSync(file, "utf8"))
			.filter((specifier) => FORBIDDEN.test(specifier))
			.map((specifier) => `${path.relative(root, file)} -> ${specifier}`),
	);

describe("admin framework boundary", () => {
	it("no file of the admin imports next/*, next-auth or @monti-cms/nextjs", () => {
		const files = sourcesUnder(SRC);
		const names = files.map((file) => path.relative(SRC, file));
		// The scan reaches the screens, the hooks, the host layout and the router, not only one folder.
		expect(names).toContain("screens/entries/entry-editor-shell.tsx");
		expect(names).toContain("hooks/public.ts");
		expect(names).toContain("host/layout.tsx");
		expect(names).toContain("router/index.tsx");
		expect(violationsIn(files, SRC)).toEqual([]);
	});

	it("the scan catches each way of importing the framework", () => {
		const dir = mkdtempSync(path.join(tmpdir(), "admin-boundary-"));
		const cases = [
			'import Link from "next/link";',
			'import type { Route } from "next";',
			'export { redirect } from "next/navigation";',
			'const headers = await import("next/headers");',
			'import { auth } from "next-auth";',
			'import "@monti-cms/nextjs/admin";',
		];
		const files = cases.map((line, index) => {
			const file = path.join(dir, `case-${index}.ts`);
			writeFileSync(file, `${line}\n`);
			return file;
		});
		const clean = path.join(dir, "clean.ts");
		writeFileSync(
			clean,
			'// import Link from "next/link";\nimport { useTheme } from "next-themes";\nexport const next = 1;\n',
		);
		expect(violationsIn([...files, clean], dir)).toHaveLength(cases.length);
	});
});
