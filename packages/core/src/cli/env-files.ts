import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * Takes `--env-file <path>` or `--env-file=<path>` out of a command's arguments. One with no path after it is refused, not passed over: the
 * person meant a file, and the command would otherwise run on other values without saying so.
 */
export function takeEnvFile(argv: string[]): { argv: string[]; file?: string } {
	const rest: string[] = [];
	let file: string | undefined;
	for (let at = 0; at < argv.length; at++) {
		const arg = argv[at] as string;
		if (arg !== "--env-file" && !arg.startsWith("--env-file=")) {
			rest.push(arg);
			continue;
		}
		const value = arg === "--env-file" ? argv[++at] : arg.slice("--env-file=".length);
		if (value === undefined || value === "") throw new Error("--env-file needs a path: --env-file .env.production");
		file = value;
	}
	return { argv: rest, file };
}

const LINE =
	/(?:^|^)\s*(?:export\s+)?([\w.-]+)(?:\s*=\s*?|:\s+?)(\s*'(?:\\'|[^'])*'|\s*"(?:\\"|[^"])*"|\s*`(?:\\`|[^`])*`|[^#\r\n]+)?\s*(?:#.*)?(?:$|$)/gm;

/**
 * An env file's names and values, in the file's order: the parser of `dotenv` as `@next/env` 16 carries it, kept to its letter. Node's own
 * (`util.parseEnv`) gives the names sorted, and a value that names another depends on which was read first.
 */
export function parseEnvFile(text: string): Record<string, string> {
	const parsed: Record<string, string> = {};
	for (const [, key, raw] of text.replace(/\r\n?/gm, "\n").matchAll(LINE)) {
		let value = (raw ?? "").trim();
		const quote = value[0];
		value = value.replace(/^(['"`])([\s\S]*)\1$/gm, "$2");
		if (quote === '"') value = value.replace(/\\n/g, "\n").replace(/\\r/g, "\r");
		parsed[key as string] = value;
	}
	return parsed;
}

/**
 * A value with the values it names put in: `$NAME`, `${NAME}`, and `${NAME:-fallback}`. A `$` after a backslash is left as it is. This is
 * the code of `dotenv-expand` as `@next/env` 16 carries it, kept to its letter (it works from the last `$` back, and takes a name from the
 * environment first, then the fallback, then the file being read): the command must read the value the site reads, oddities and all.
 */
function withNamed(value: string, env: Record<string, string | undefined>, parsed: Record<string, string>): string {
	const last = [...value.matchAll(/(?!(?<=\\))\$/g)].at(-1)?.index ?? -1;
	if (last === -1) return value;
	const named = value.slice(last).match(/((?!(?<=\\))\${?([\w]+)(?::-([^}\\]*))?}?)/);
	if (named == null) return value;
	const [, whole, key, fallback] = named as unknown as [string, string, string, string | undefined];
	return withNamed(value.replace(whole, env[key] || fallback || parsed[key] || ""), env, parsed);
}

/**
 * The site's env files, read the way Next reads them, so `monti` sees the values the site runs with: what the environment already holds wins,
 * then `.env.<mode>.local`, `.env.local`, `.env.<mode>`, `.env` (the first file that names a value gives it). `mode` is `NODE_ENV`, or
 * `development`. Returns where each value it set came from, so a message can say "in .env.local" without printing the value.
 *
 * A value may name another (`DATABASE_URL=postgres://$DB_HOST/site`), as in Next: a name is looked up in the environment and the files read
 * before, then in the file itself. A `$` that is the value's own is written `\$`. As in Next too, a value of the environment that a file
 * also names has the names in it put in.
 */
export function loadEnvFiles(
	root: string,
	env: Record<string, string | undefined> = process.env,
	mode = env.NODE_ENV ?? "development",
	/** A file named on the command line (`--env-file`): read before the others, so its values win over theirs. */
	first?: string,
): Map<string, string> {
	const from = new Map<string, string>();
	// Next leaves `.env.local` out under test, so tests get the same values on every machine.
	const names = [
		...(first ? [first] : []),
		`.env.${mode}.local`,
		...(mode === "test" ? [] : [".env.local"]),
		`.env.${mode}`,
		".env",
	];
	// What the environment held before any file was read, and what the files give: Next's own steps (`processEnv`), in its order.
	const held = new Set(Object.keys(env).filter((key) => env[key] !== undefined));
	const given: Record<string, string> = {};
	for (const name of names) {
		const file = path.resolve(root, name);
		if (!existsSync(file)) {
			if (name === first) throw new Error(`There is no env file ${name}.`);
			continue;
		}
		const parsed = parseEnvFile(readFileSync(file, "utf8"));
		try {
			for (const key of Object.keys(parsed))
				parsed[key] = withNamed(env[key] ?? (parsed[key] as string), env, parsed).replace(/\\\$/g, "$");
		} catch (error) {
			// A value that names itself (`A=$A`) never ends. Next skips the whole file with an error on its console; a command says which file.
			if (error instanceof RangeError) throw new Error(`${name}: a value names itself.`);
			throw error;
		}
		for (const [key, value] of Object.entries(parsed)) {
			// While the files are read, a later file's names see this file's values (and a value the environment held, with its names put in).
			env[key] = value;
			if (held.has(key) || key in given) continue;
			given[key] = value;
			from.set(key, name);
		}
	}
	Object.assign(env, given);
	return from;
}
