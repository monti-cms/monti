import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseEnv } from "node:util";

/** Files read when `--env-file` is not given (same order as Next: `.env.local` comes before `.env`). */
export const DEFAULT_ENV_FILES = [".env.local", ".env"] as const;

/**
 * Reads env files into `env`. **Never overrides an existing value** (values from the shell win, and earlier files win).
 * Returns the files read (paths relative to `cwd`). Missing default files are skipped; a missing explicitly chosen file is an error.
 */
export function loadEnvFiles(
	cwd: string,
	files: readonly string[] | undefined,
	env: Record<string, string | undefined> = process.env,
): string[] {
	const chosen = files ?? DEFAULT_ENV_FILES;
	const loaded: string[] = [];
	for (const file of chosen) {
		const full = path.resolve(cwd, file);
		if (!existsSync(full)) {
			if (files) throw new Error(`env file not found: ${file}`);
			continue;
		}
		const values = parseEnv(readFileSync(full, "utf8"));
		for (const [key, value] of Object.entries(values)) {
			if (env[key] === undefined && value !== undefined) env[key] = value;
		}
		loaded.push(file);
	}
	return loaded;
}
