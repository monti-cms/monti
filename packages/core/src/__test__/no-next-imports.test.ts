import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The core is framework-neutral: its HTTP layer speaks the standard `Request` and `Response`, and what a framework must supply (reading the current
 * request's headers, redirecting after login) comes in through the login connection (`CmsAuth.requestHeaders`, `CmsAuth.rethrow`).
 * Everything Next-specific (`next/*`, NextAuth, `withCms`, the route handler) lives in `@monti-cms/nextjs`, so a source file of the core that
 * imports it again breaks that boundary.
 */

const SRC = path.resolve(import.meta.dirname, "..");

const FORBIDDEN = /^(next|next-auth|@auth\/core|@monti-cms\/nextjs)(\/|$)/;

const code = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

function importsOf(source: string): string[] {
	const patterns = [
		/\b(?:import|export)\s+(?:type\s+)?[^"';]*?\sfrom\s*["']([^"']+)["']/g,
		/\bimport\s*["']([^"']+)["']/g,
		/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
		/\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
	];
	const specifiers = new Set<string>();
	for (const pattern of patterns)
		for (const match of code(source).matchAll(pattern)) specifiers.add(match[1] as string);
	return [...specifiers];
}

/** Files of the `monti init` scaffolding: the Next code they hold is text written into the site, so their import lines are strings, not imports of the core. */
const GENERATED_CODE = new Set([path.join(SRC, "cli", "templates.ts"), path.join(SRC, "cli", "init.ts")]);

/** The source files (tests and test fixtures left out) under `dir`. */
function sourcesUnder(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) return entry.name === "__test__" ? [] : sourcesUnder(full);
		return /\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) && !GENERATED_CODE.has(full)
			? [full]
			: [];
	});
}

const violationsIn = (files: string[], root: string) =>
	files.flatMap((file) =>
		importsOf(readFileSync(file, "utf8"))
			.filter((specifier) => FORBIDDEN.test(specifier))
			.map((specifier) => `${path.relative(root, file)} -> ${specifier}`),
	);

describe("core framework boundary", () => {
	it("no source file of the core imports next/*, next-auth or @monti-cms/nextjs", () => {
		const files = sourcesUnder(SRC);
		const names = files.map((file) => path.relative(SRC, file));
		// The scan reaches the login code and the HTTP routes, which is where the Next imports used to be.
		expect(names).toContain("adapters/auth/auth-gateway.ts");
		expect(names).toContain("http/v1/session/sign-out/route.ts");
		expect(names).toContain("cms/create-cms.ts");
		expect(violationsIn(files, SRC)).toEqual([]);
	});

	it("the scan catches each way of importing the framework", () => {
		const dir = mkdtempSync(path.join(tmpdir(), "core-boundary-"));
		const cases = [
			'import { unstable_rethrow } from "next/navigation";',
			'import type { NextConfig } from "next";',
			'const { headers } = await import("next/headers");',
			'import NextAuth from "next-auth";',
			'export { githubAuth } from "@monti-cms/nextjs/auth";',
		];
		const files = cases.map((line, index) => {
			const file = path.join(dir, `case-${index}.ts`);
			writeFileSync(file, `${line}\n`);
			return file;
		});
		const clean = path.join(dir, "clean.ts");
		writeFileSync(clean, '// import { redirect } from "next/navigation";\nexport const nextPage = 1;\n');
		expect(violationsIn([...files, clean], dir)).toHaveLength(cases.length);
	});
});
