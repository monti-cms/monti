import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseEnv } from "node:util";
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
};

const read = (file: string) => (existsSync(file) ? readFileSync(file, "utf8") : null);
/** A text with these lines after it, on lines of their own. */
const withLines = (text: string | null, lines: string[]) =>
	`${text ?? ""}${text && !text.endsWith("\n") ? "\n" : ""}${lines.join("\n")}\n`;

/**
 * Writes the site's Monti files and adds what its own files lack (docs/design/features/20-release.md, `monti init`):
 * - a file that exists is never written over, whatever is in it;
 * - `.env.local` gets only the values that neither it nor `.env` names (Next reads both), and `.env` is not touched;
 * - `.gitignore` gets the lines it lacks, and `package.json` the two database scripts when it has none by those names.
 * A second run on its own result writes nothing.
 */
export function writeSite(site: Site, answers: Answers, options: { dryRun: boolean; secret: string }): Written {
	const { cwd } = site;
	const done: Written = { created: [], kept: [], added: [] };
	const put = (file: string, text: string) => {
		if (options.dryRun) return;
		mkdirSync(path.dirname(path.join(cwd, file)), { recursive: true });
		writeFileSync(path.join(cwd, file), text);
	};

	for (const { file, text } of planFiles(site, answers)) {
		if (existsSync(path.join(cwd, file))) done.kept.push(file);
		else {
			put(file, text);
			done.created.push(file);
		}
	}

	// The environment: what the site's two env files name already stays as it is, an empty value too.
	const local = read(path.join(cwd, ".env.local"));
	const named = new Set(Object.keys({ ...parseEnv(read(path.join(cwd, ".env")) ?? ""), ...parseEnv(local ?? "") }));
	const lacking = envValues(site, answers, options.secret).filter(({ name }) => !named.has(name));
	if (lacking.length > 0) {
		put(
			".env.local",
			withLines(
				local,
				lacking.map(({ name, value }) => `${name}=${value}`),
			),
		);
		done.added.push({ file: ".env.local", what: lacking.map(({ name }) => name) });
	}

	const ignored = read(path.join(cwd, ".gitignore"));
	const lines = (ignored ?? "").split(/\r?\n/).map((line) => line.trim());
	const has = (...patterns: string[]) => lines.some((line) => patterns.includes(line));
	const ignore = [
		...(has(".env.local", "/.env.local", ".env*", ".env*.local", ".env.*") ? [] : [".env.local"]),
		...(has(".monti", ".monti/", "/.monti", "/.monti/") ? [] : [".monti/"]),
	];
	if (ignore.length > 0) {
		put(".gitignore", withLines(ignored, ignore));
		done.added.push({ file: ".gitignore", what: ignore });
	}

	const manifestText = read(path.join(cwd, "package.json"));
	if (manifestText !== null) {
		const manifest = JSON.parse(manifestText) as { scripts?: Record<string, string> };
		const scripts = { "db:setup": "monti db:setup", "db:migrate": "monti db:migrate" };
		const fresh = Object.entries(scripts).filter(([name]) => manifest.scripts?.[name] === undefined);
		if (fresh.length > 0) {
			// The file keeps its own indent and its last newline: only the scripts are new.
			const indent = manifestText.match(/^([ \t]+)"/m)?.[1] ?? "\t";
			manifest.scripts = { ...manifest.scripts, ...Object.fromEntries(fresh) };
			put("package.json", `${JSON.stringify(manifest, null, indent)}${manifestText.endsWith("\n") ? "\n" : ""}`);
			done.added.push({ file: "package.json", what: fresh.map(([name]) => `the script ${name}`) });
		}
	}
	return done;
}
