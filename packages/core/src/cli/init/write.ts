import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { isDeepStrictEqual, parseEnv } from "node:util";
import type { Answers } from "./answers";
import type { Site } from "./detect";
import { envValues, planFiles } from "./files";

/** What `monti init` did to a site's folder, or with `dryRun` would do. Paths are the site's own. */
export type Written = {
	/** New files. */
	created: string[];
	/** Files that were there already: left exactly as they were. */
	kept: string[];
	/** What was added to a file of the site's own: a value it lacked, a line, a script. Nothing in such a file is changed or removed. */
	added: { file: string; what: string[] }[];
	/** The lines for `package.json`'s scripts that a person adds, where the file could not be edited without changing the rest of it. */
	byHand: string[];
};

/** A write that failed partway: what was written before it, and what was not. Nothing is taken back, since a second run writes the rest. */
export class WriteFailed extends Error {
	constructor(
		readonly file: string,
		readonly reason: string,
		readonly written: string[],
		readonly left: string[],
	) {
		super(
			`Could not write ${file} (${reason}). Written: ${written.length > 0 ? written.join(", ") : "nothing"}. Not written: ${left.join(", ")}. Run monti init again once it can be written: it writes only what is missing.`,
		);
		this.name = "WriteFailed";
	}
}

const read = (file: string) => (existsSync(file) ? readFileSync(file, "utf8") : null);
/** A text with these lines after it, on lines of their own, in the text's own line endings. */
function withLines(text: string | null, lines: string[]) {
	const eol = text?.includes("\r\n") ? "\r\n" : "\n";
	return `${text ?? ""}${text && !text.endsWith("\n") ? eol : ""}${lines.join(eol)}${eol}`;
}

const SCRIPTS = { "db:setup": "monti db:setup", "db:migrate": "monti db:migrate" };

/**
 * A `package.json` with the two database scripts it lacks, or `null` when it has both. Nothing else in the file changes: its byte-order
 * mark, line endings, indentation and last newline stay. The result is read back and must be the same manifest with the scripts; a file that
 * cannot be edited that surely (it is not JSON, or its `scripts` are written in a way this does not follow) is left alone, and the lines are
 * returned for a person to add (`byHand`).
 */
function withScripts(source: string): { text: string; names: string[] } | { byHand: string[] } | null {
	const lines = (entries: [string, string][]) =>
		entries.map(([name, command]) => `${JSON.stringify(name)}: ${JSON.stringify(command)}`);
	const bom = source.startsWith("﻿") ? "﻿" : "";
	const body = source.slice(bom.length);
	let manifest: { scripts?: Record<string, string> };
	try {
		manifest = JSON.parse(body);
	} catch {
		return { byHand: lines(Object.entries(SCRIPTS)) };
	}
	if (typeof manifest !== "object" || manifest === null || Array.isArray(manifest))
		return { byHand: lines(Object.entries(SCRIPTS)) };
	const fresh = Object.entries(SCRIPTS).filter(([name]) => manifest.scripts?.[name] === undefined);
	if (fresh.length === 0) return null;

	const eol = body.includes("\r\n") ? "\r\n" : "\n";
	const indent = body.match(/^([ \t]+)"/m)?.[1] ?? "\t";
	const tail = body.match(/\s*$/)?.[0] ?? "";
	const print = (value: unknown) => `${JSON.stringify(value, null, indent).replace(/\n/g, eol)}${tail}`;
	const wanted = { ...manifest, scripts: { ...manifest.scripts, ...Object.fromEntries(fresh) } };
	// The file as JSON.stringify prints it (npm writes it so): printed again, only the scripts are new.
	let text = print(manifest) === body ? print(wanted) : null;
	if (text === null) {
		// Written another way (short lists on one line, as a formatter leaves them): the new lines go in at the head of its "scripts", and every
		// other byte stays.
		const at = /^([ \t]*)"scripts"\s*:\s*\{/m.exec(body);
		if (at) {
			const head = at.index + at[0].length;
			text = `${body.slice(0, head)}${lines(fresh)
				.map((line) => `${eol}${at[1]}${indent}${line},`)
				.join("")}${body.slice(head)}`;
		}
	}
	try {
		if (text !== null && isDeepStrictEqual(JSON.parse(text), wanted))
			return { text: `${bom}${text}`, names: fresh.map(([name]) => name) };
	} catch {
		// Not JSON any more: the file is left alone.
	}
	return { byHand: lines(fresh) };
}

/** Every env file in the site's folder, whatever mode it is for (`.env`, `.env.local`, `.env.production`); an example is not one. */
const envFiles = (cwd: string) =>
	readdirSync(cwd).filter((name) => /^\.env(\..+)?$/.test(name) && !/\.(example|sample|template|dist)$/.test(name));

const REASONS: Record<string, string> = {
	EACCES: "no permission to write there",
	EPERM: "no permission to write there",
	EROFS: "the disk is read-only",
	ENOSPC: "the disk is full",
};

/**
 * Writes the site's Monti files and adds what its own files lack (docs/design/features/20-release.md, `monti init`):
 * - a file that exists is never written over, whatever is in it;
 * - `.env.local` gets only the values the site has nowhere: a name that any of its env files holds (`.env.local` comes before `.env` and
 *   `.env.production`, so a placeholder there would hide their value), or that the environment holds, is not added. No other env file is
 *   touched;
 * - `.gitignore` gets the lines it lacks, and `package.json` the two database scripts when it has none by those names.
 * Everything is read and settled before the first write, and `.gitignore` is written first, so `.env.local` is never there unignored. A write
 * that fails throws {@link WriteFailed}. A second run on its own result writes nothing.
 */
export function writeSite(
	site: Site,
	answers: Answers,
	options: { dryRun: boolean; secret: string; env: Record<string, string | undefined> },
): Written {
	const { cwd } = site;
	const done: Written = { created: [], kept: [], added: [], byHand: [] };
	const files: { file: string; text: string; mode?: number }[] = [];
	for (const { file, text } of planFiles(site, answers)) {
		if (existsSync(path.join(cwd, file))) done.kept.push(file);
		else {
			files.push({ file, text });
			done.created.push(file);
		}
	}

	const held = new Set(
		Object.entries(options.env)
			.filter(([, value]) => value !== undefined && value.trim() !== "")
			.map(([name]) => name),
	);
	for (const name of envFiles(cwd))
		for (const key of Object.keys(parseEnv(readFileSync(path.join(cwd, name), "utf8")))) held.add(key);
	const lacking = envValues(site, answers, options.secret).filter(({ name }) => !held.has(name));
	// Its secrets are the site owner's alone: a new file is made for them only (an existing one keeps its own mode).
	const local =
		lacking.length > 0
			? {
					file: ".env.local",
					text: withLines(
						read(path.join(cwd, ".env.local")),
						lacking.map(({ name, value }) => `${name}=${value}`),
					),
					mode: 0o600,
				}
			: null;
	if (local) done.added.push({ file: ".env.local", what: lacking.map(({ name }) => name) });

	const ignored = read(path.join(cwd, ".gitignore"));
	const lines = (ignored ?? "").split(/\r?\n/).map((line) => line.trim());
	const has = (...patterns: string[]) => lines.some((line) => patterns.includes(line));
	const ignore = [
		...(has(".env.local", "/.env.local", ".env*", ".env*.local", ".env.*") ? [] : [".env.local"]),
		...(has(".monti", ".monti/", "/.monti", "/.monti/") ? [] : [".monti/"]),
	];
	const gitignore = ignore.length > 0 ? { file: ".gitignore", text: withLines(ignored, ignore) } : null;
	if (gitignore) done.added.push({ file: ".gitignore", what: ignore });

	const manifestText = read(path.join(cwd, "package.json"));
	const scripts = manifestText === null ? null : withScripts(manifestText);
	const manifest = scripts && "text" in scripts ? { file: "package.json", text: scripts.text } : null;
	if (scripts && "text" in scripts)
		done.added.push({ file: "package.json", what: scripts.names.map((name) => `the script ${name}`) });
	else if (scripts) done.byHand = scripts.byHand;
	if (options.dryRun) return done;

	const writes: { file: string; text: string; mode?: number }[] = [gitignore, ...files, local, manifest].filter(
		(write) => write !== null,
	);
	const written: string[] = [];
	for (const [at, write] of writes.entries()) {
		const file = path.join(cwd, write.file);
		try {
			mkdirSync(path.dirname(file), { recursive: true });
			writeFileSync(file, write.text, { mode: write.mode });
			written.push(write.file);
		} catch (error) {
			const code = (error as NodeJS.ErrnoException).code ?? "";
			throw new WriteFailed(
				write.file,
				REASONS[code] ?? (error instanceof Error ? (error.message.split("\n")[0] ?? "") : String(error)),
				written,
				writes.slice(at).map((each) => each.file),
			);
		}
	}
	return done;
}
