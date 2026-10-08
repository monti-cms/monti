import { parseJsonc } from "./config-paths";

/** Small, careful edits `monti init` makes to files the app owns. Each returns the new text, or `undefined` when the file cannot be edited safely. */

/** The lines `.gitignore` needs so the secret file is never committed. */
const GITIGNORE_LINES = [".env.local", ".env*.local"];

/** `.gitignore` text with `.env.local` and `.env*.local` added when absent; the other lines are untouched. `existing` is `undefined` for a missing file. */
export function addEnvToGitignore(existing: string | undefined): string {
	const have = new Set((existing ?? "").split(/\r?\n/).map((line) => line.trim()));
	const missing = GITIGNORE_LINES.filter((line) => !have.has(line));
	if (missing.length === 0) return existing ?? "";
	const base = existing ?? "";
	const separator = base === "" || base.endsWith("\n") ? "" : "\n";
	return `${base}${separator}${base === "" ? "" : "\n"}# Local env files (monti init)\n${missing.join("\n")}\n`;
}

/** Whether a `.gitignore` text covers the `.monti/` folder (where `monti init` keeps its progress). */
export function ignoresState(gitignore: string): boolean {
	return gitignore
		.split(/\r?\n/)
		.map((line) => line.trim())
		.some((line) => [".monti", ".monti/", "/.monti", "/.monti/", ".monti/*"].includes(line));
}

/** `.gitignore` text with `.monti/` added when it is not covered; the other lines are untouched. `existing` is `undefined` for a missing file. */
export function addStateToGitignore(existing: string | undefined): string {
	if (ignoresState(existing ?? "")) return existing ?? "";
	const base = existing ?? "";
	const separator = base === "" || base.endsWith("\n") ? "" : "\n";
	return `${base}${separator}${base === "" ? "" : "\n"}# Progress of monti init (monti init --resume)\n.monti/\n`;
}

type Json = Record<string, unknown>;

/**
 * `tsconfig.json` text with `"resolveJsonModule": true` in `compilerOptions`, keeping the file's comments and formatting (a text insert, not a rewrite).
 * `undefined` when the file has an `extends` (the value may come from there), has no `compilerOptions` object, or the edit does not parse back to the same
 * file plus the one option.
 */
export function addResolveJsonModule(text: string): string | undefined {
	const before = parseJsonc(text) as Json | undefined;
	const options = before?.compilerOptions as Json | undefined;
	if (!before || typeof options !== "object" || options === null || "extends" in before) return undefined;
	let after: string;
	const existing = /("resolveJsonModule"\s*:\s*)false\b/.exec(text);
	if (existing) {
		after = text.replace(existing[0], `${existing[1]}true`);
	} else {
		const open = /"compilerOptions"\s*:\s*\{/.exec(text);
		if (!open) return undefined;
		const at = open.index + open[0].length;
		const rest = text.slice(at);
		const comma = Object.keys(options).length > 0 ? "," : "";
		const sameLine = /^[ \t]*\S/.test(rest) && !/^[ \t]*(\r?\n|\/\/)/.test(rest);
		if (sameLine) {
			after = `${text.slice(0, at)} "resolveJsonModule": true${comma}${rest}`;
		} else {
			const indent = /\n([ \t]+)\S/.exec(rest)?.[1] ?? "  ";
			after = `${text.slice(0, at)}\n${indent}"resolveJsonModule": true${comma}${rest}`;
		}
	}
	// It must read back as the same file with only that option set.
	const expected = { ...before, compilerOptions: { ...options, resolveJsonModule: true } };
	const got = parseJsonc(after) as Json | undefined;
	if (!got || JSON.stringify(sortKeys(got)) !== JSON.stringify(sortKeys(expected))) return undefined;
	return after;
}

function sortKeys(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(sortKeys);
	if (value && typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value as Json)
				.sort(([a], [b]) => a.localeCompare(b))
				.map(([key, item]) => [key, sortKeys(item)]),
		);
	}
	return value;
}

/**
 * `pnpm-workspace.yaml` text that lets esbuild run its install script (`allowBuilds: esbuild: true`), which pnpm 12 asks for before it finishes an install. `existing`
 * is `undefined` for a missing file. Returns `"ok"` when `allowBuilds.esbuild` is already `true` or `false` (the person decided), the new text when it is missing or is
 * the placeholder pnpm writes (`set this to true or false`), and `undefined` when the file is shaped so that a text edit would not be safe (a flow map with other
 * entries). It never writes a second `allowBuilds` or a second `esbuild` key, and the other lines are untouched.
 */
export function allowEsbuildBuild(existing: string | undefined): string | "ok" | undefined {
	const text = existing ?? "";
	const eol = text.includes("\r\n") ? "\r\n" : "\n";
	if (text.trim() === "") return `allowBuilds:${eol}  esbuild: true${eol}`;
	const lines = text.split(/\r?\n/);
	const at = lines.findIndex((line) => /^allowBuilds\s*:/.test(line));
	if (at === -1) {
		const base = text.endsWith("\n") ? text : `${text}${eol}`;
		return `${base}allowBuilds:${eol}  esbuild: true${eol}`;
	}
	const rest = (lines[at] ?? "")
		.replace(/^allowBuilds\s*:/, "")
		.replace(/\s+#.*$/, "")
		.trim();
	if (rest.startsWith("{")) {
		if (rest === "{}")
			return [...lines.slice(0, at), "allowBuilds:", "  esbuild: true", ...lines.slice(at + 1)].join(eol);
		return /\besbuild\s*:\s*(true|false)\b/.test(rest) ? "ok" : undefined;
	}
	if (rest !== "" && rest !== "~" && rest !== "null") return undefined;
	let end = at + 1;
	while (end < lines.length && (lines[end] === "" || /^[ \t#]/.test(lines[end] ?? ""))) end++;
	const block = lines.slice(at + 1, end);
	const key = block.findIndex((line) => /^[ \t]+["']?esbuild["']?\s*:/.test(line));
	if (key !== -1) {
		const line = block[key] ?? "";
		const value = line
			.replace(/^[ \t]+["']?esbuild["']?\s*:/, "")
			.replace(/\s+#.*$/, "")
			.trim();
		if (value === "true" || value === "false") return "ok";
		const fixed = line.replace(/^([ \t]+["']?esbuild["']?\s*:).*$/, "$1 true");
		return [...lines.slice(0, at + 1 + key), fixed, ...lines.slice(at + 2 + key)].join(eol);
	}
	const child = block.find((line) => /^[ \t]+\S/.test(line) && !/^\s*#/.test(line));
	const indent = /^([ \t]+)/.exec(child ?? "")?.[1] ?? "  ";
	return [...lines.slice(0, at + 1), `${indent}esbuild: true`, ...lines.slice(at + 1)].join(eol);
}
