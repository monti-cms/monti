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
