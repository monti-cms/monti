import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { CONFIG_CANDIDATES, parseJsonc } from "./config-paths";

/**
 * The import-boundary check: `monti.config.ts` holds the database and login settings and makes the server-side CMS instance, so it must never reach a client
 * bundle. A file that starts with `"use client"` and everything it imports (through relative paths and the `paths` of `tsconfig.json`) is client code. The check
 * reports each import chain from such a file to the config file, or to a package that is server-only (`@monti-cms/core/server`, `@monti-cms/auth`, ...).
 * Type-only imports are erased by the compiler and do not count.
 *
 * It reads source text (no build), so it runs in a second: `monti check:boundary`, and once per dev server start from `withCms`.
 */

/** Packages that hold server code. A client file importing one drags the server into the browser bundle. */
export const SERVER_ONLY_MODULES = [
	"@monti-cms/core/server",
	"@monti-cms/core/runtime",
	"@monti-cms/core/plugin/server",
	"@monti-cms/auth",
	"@monti-cms/nextjs/auth",
] as const;

export interface BoundaryViolation {
	/** The client file the chain starts in (relative to `cwd`, `/` separators). */
	readonly client: string;
	/** The files from `client` to the one that must stay on the server (the last item may be a package name). */
	readonly chain: readonly string[];
	/** What the chain ends in: `config` (the config file) or the server-only package. */
	readonly reaches: string;
}

const SOURCE = /\.(?:[cm]?[jt]sx?)$/;
const SKIP_DIRS = new Set(["node_modules", ".next", ".git", "dist", "vendor", "out", "build", "coverage", ".turbo"]);
const RESOLVE_SUFFIXES = ["", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".mts", ".cjs", ".cts"];

const posix = (file: string) => file.split(path.sep).join("/");

/** Every source file under `dir`, skipping dependency, build and vendored folders. */
function sourceFiles(dir: string, out: string[] = []): string[] {
	for (const entry of readdirSync(dir)) {
		if (SKIP_DIRS.has(entry) || entry.startsWith(".")) continue;
		const full = path.join(dir, entry);
		const stat = statSync(full);
		if (stat.isDirectory()) sourceFiles(full, out);
		else if (SOURCE.test(entry) && !entry.endsWith(".d.ts")) out.push(full);
	}
	return out;
}

/** Blank out comments, so an import written in a comment does not count. Keeps string contents (the `"use client"` directive and module names). */
function stripComments(text: string): string {
	let out = "";
	for (let index = 0; index < text.length; index++) {
		const char = text[index];
		const next = text[index + 1];
		if (char === '"' || char === "'" || char === "`") {
			const quote = char;
			out += char;
			for (index++; index < text.length && text[index] !== quote; index++) {
				out += text[index];
				if (text[index] === "\\") out += text[++index] ?? "";
			}
			out += quote;
		} else if (char === "/" && next === "/") {
			while (index < text.length && text[index] !== "\n") index++;
			out += "\n";
		} else if (char === "/" && next === "*") {
			index += 2;
			while (index < text.length && !(text[index] === "*" && text[index + 1] === "/")) index++;
			index++;
		} else out += char;
	}
	return out;
}

/** Whether the file starts with a `"use client"` directive (comments and other directives before it are fine). */
function isClientFile(text: string): boolean {
	const code = stripComments(text);
	for (const statement of code.split(/;|\n/)) {
		const trimmed = statement.trim();
		if (!trimmed) continue;
		if (/^(["'])use client\1$/.test(trimmed)) return true;
		if (!/^(["'])[^"']*\1$/.test(trimmed)) return false;
	}
	return false;
}

/** The module names a file imports at run time (static, re-exported or dynamic), leaving out type-only imports and exports. */
export function importsOf(text: string): string[] {
	const code = stripComments(text);
	const found: string[] = [];
	const add = (name: string | undefined) => {
		if (name) found.push(name);
	};
	for (const match of code.matchAll(/\bimport\s+(?!type\b)([^"'`;]*?)\s*from\s*(["'])([^"']+)\2/g)) {
		const clause = match[1] ?? "";
		const named = /^\{([^}]*)\}$/.exec(clause.trim());
		// `import { type A, type B } from "x"` is erased whole; one value import keeps it.
		const onlyTypes =
			named && named[1]?.split(",").every((part) => !part.trim() || /^type\s/.test(part.trim())) === true;
		if (!onlyTypes) add(match[3]);
	}
	for (const match of code.matchAll(/\bimport\s*(["'])([^"']+)\1/g)) add(match[2]);
	for (const match of code.matchAll(/\bexport\s+(?!type\b)(?:\*|\{[^}]*\})\s*(?:as\s+\w+\s*)?from\s*(["'])([^"']+)\1/g))
		add(match[2]);
	for (const match of code.matchAll(/\bimport\s*\(\s*(["'])([^"']+)\1\s*\)/g)) add(match[2]);
	return found;
}

/** The `paths` aliases of `tsconfig.json` as [prefix, folders] pairs (`@/*` -> `./*`), with `baseUrl` applied. */
function aliasesOf(cwd: string): { prefix: string; wildcard: boolean; targets: string[] }[] {
	const file = path.join(cwd, "tsconfig.json");
	if (!existsSync(file)) return [];
	const tsconfig = parseJsonc(readFileSync(file, "utf8")) as
		| { compilerOptions?: { baseUrl?: string; paths?: Record<string, string[]> } }
		| undefined;
	const options = tsconfig?.compilerOptions;
	const base = path.resolve(cwd, options?.baseUrl ?? ".");
	return Object.entries(options?.paths ?? {}).map(([pattern, targets]) => ({
		prefix: pattern.replace(/\*$/, ""),
		wildcard: pattern.endsWith("*"),
		targets: targets.map((target) => path.resolve(base, target.replace(/\*$/, ""))),
	}));
}

/**
 * Finds every import chain from a client file to the config file or a server-only package.
 * `cwd` is the app folder (where `package.json` and `tsconfig.json` are). Throws if it cannot read the folder.
 */
export function findBoundaryViolations(cwd: string): BoundaryViolation[] {
	const root = path.resolve(cwd);
	const files = sourceFiles(root);
	const texts = new Map(files.map((file) => [file, readFileSync(file, "utf8")] as const));
	const aliases = aliasesOf(root);
	const configFiles = new Set(
		CONFIG_CANDIDATES.map((candidate) => path.resolve(root, candidate)).filter((file) => texts.has(file)),
	);
	const rel = (file: string) => posix(path.relative(root, file));

	const tryFile = (base: string): string | undefined => {
		for (const suffix of RESOLVE_SUFFIXES) if (texts.has(base + suffix)) return base + suffix;
		for (const suffix of RESOLVE_SUFFIXES.slice(1))
			if (texts.has(path.join(base, `index${suffix}`))) return path.join(base, `index${suffix}`);
		return undefined;
	};
	/** The app file a module name points at, or `undefined` for a package (or a file that is not source we read). */
	const resolve = (from: string, name: string): string | undefined => {
		if (name.startsWith(".")) {
			const base = path.resolve(path.dirname(from), name);
			// `./x.js` in a TypeScript file stands for `./x.ts`.
			return tryFile(base) ?? tryFile(base.replace(/\.(?:[cm]?js)$/, ""));
		}
		for (const alias of aliases) {
			if (!name.startsWith(alias.prefix) || (!alias.wildcard && name !== alias.prefix)) continue;
			const rest = name.slice(alias.prefix.length);
			for (const target of alias.targets) {
				const found = tryFile(alias.wildcard ? path.join(target, rest) : target);
				if (found) return found;
			}
		}
		return undefined;
	};
	const serverOnly = (name: string) =>
		SERVER_ONLY_MODULES.find((module) => name === module || name.startsWith(`${module}/`));

	const violations: BoundaryViolation[] = [];
	for (const [start, text] of texts) {
		if (!isClientFile(text)) continue;
		// Breadth first, so the chain reported is the shortest.
		const seen = new Set([start]);
		const queue: { file: string; chain: string[] }[] = [{ file: start, chain: [rel(start)] }];
		while (queue.length > 0) {
			const { file, chain } = queue.shift() ?? { file: start, chain: [] };
			for (const name of importsOf(texts.get(file) ?? "")) {
				const only = serverOnly(name);
				if (only) {
					violations.push({ client: rel(start), chain: [...chain, name], reaches: only });
					continue;
				}
				const next = resolve(file, name);
				if (!next || seen.has(next)) continue;
				seen.add(next);
				if (configFiles.has(next)) {
					violations.push({ client: rel(start), chain: [...chain, rel(next)], reaches: "config" });
					continue;
				}
				queue.push({ file: next, chain: [...chain, rel(next)] });
			}
		}
	}
	return violations;
}

/** The violations as text, one chain per line with how to fix it; empty when there is none. */
export function formatBoundaryViolations(violations: readonly BoundaryViolation[]): string {
	if (violations.length === 0) return "";
	return [
		"A client component imports server-only code. monti.config.ts holds the database and login settings and must stay on the server:",
		...violations.map((violation) => `  ${violation.chain.join(" -> ")}`),
		"Import it from a server file instead (a server component, a route file, a script). A client component gets data as props, or through the API route.",
	].join("\n");
}
