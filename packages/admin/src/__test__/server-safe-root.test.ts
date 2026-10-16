import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A plugin's admin module imports `@monti-cms/admin` (for `defineAdminPlugin`), and the admin loads that module on the server, inside a server component.
 * So the root entry point must be safe to load there: every module it reaches that is not a client module (no `"use client"`) is evaluated by the server, where
 * React has no `createContext` and no client hooks. Such a module may not call `createContext` at load; a module that needs it is a `"use client"` one.
 * The graph is followed through relative value imports and stops at client modules, which the server only refers to.
 */

const SRC = path.resolve(import.meta.dirname, "..");
const EXTENSIONS = ["", ".ts", ".tsx", "/index.ts", "/index.tsx"];

const isClientModule = (source: string): boolean =>
	/^\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*["']use client["']/.test(source);

function valueImportsOf(source: string): string[] {
	const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
	const specifiers: string[] = [];
	for (const match of code.matchAll(/\b(import|export)\s+(type\s+)?[^"';]*?\sfrom\s*["'](\.[^"']*)["']/g)) {
		if (!match[2]) specifiers.push(match[3] as string);
	}
	return specifiers;
}

function resolveRelative(from: string, specifier: string): string | null {
	const base = path.resolve(path.dirname(from), specifier);
	for (const ext of EXTENSIONS) {
		const candidate = base + ext;
		if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
	}
	return null;
}

/** The server-evaluated modules the root reaches: not client modules, followed through relative value imports. */
function serverModulesOfRoot(): string[] {
	const seen = new Set<string>();
	const server: string[] = [];
	const visit = (file: string) => {
		if (seen.has(file)) return;
		seen.add(file);
		const source = readFileSync(file, "utf8");
		if (isClientModule(source)) return;
		server.push(file);
		for (const specifier of valueImportsOf(source)) {
			const target = resolveRelative(file, specifier);
			if (target) visit(target);
		}
	};
	visit(path.join(SRC, "index.ts"));
	return server;
}

describe("@monti-cms/admin root on the server", () => {
	it("reaches no module that creates a React context without being a client module", () => {
		const offenders = serverModulesOfRoot()
			.filter((file) => /\bcreateContext\s*[<(]/.test(readFileSync(file, "utf8")))
			.map((file) => path.relative(SRC, file));
		expect(offenders).toEqual([]);
	});

	it("follows the graph far enough to mean something", () => {
		expect(serverModulesOfRoot().length).toBeGreaterThan(3);
	});
});
