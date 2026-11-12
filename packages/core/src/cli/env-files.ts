import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseEnv } from "node:util";

/**
 * The site's env files, read the way Next reads them, so `monti` sees the values the site runs with: what the environment already holds wins,
 * then `.env.<mode>.local`, `.env.local`, `.env.<mode>`, `.env` (the first file that names a value gives it). `mode` is `NODE_ENV`, or
 * `development`. Returns where each value it set came from, so a message can say "in .env.local" without printing the value.
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
	for (const name of names) {
		const file = path.resolve(root, name);
		if (!existsSync(file)) {
			if (name === first) throw new Error(`There is no env file ${name}.`);
			continue;
		}
		for (const [key, value] of Object.entries(parseEnv(readFileSync(file, "utf8")))) {
			if (env[key] !== undefined) continue;
			env[key] = value;
			from.set(key, name);
		}
	}
	return from;
}
