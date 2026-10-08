import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseEnv } from "node:util";
import { problemError } from "../core/problem.js";
/** Files read when `--env-file` is not given (same order as Next: `.env.local` comes before `.env`). */
export const DEFAULT_ENV_FILES = [".env.local", ".env"];
/**
 * Reads env files into `env`. **Never overrides an existing value** (values from the shell win, and earlier files win).
 * Returns the files read (paths relative to `cwd`). Missing default files are skipped; a missing explicitly chosen file is an error.
 */
export function loadEnvFiles(cwd, files, env = process.env) {
    const chosen = files ?? DEFAULT_ENV_FILES;
    const loaded = [];
    for (const file of chosen) {
        const full = path.resolve(cwd, file);
        if (!existsSync(full)) {
            if (files) {
                throw problemError({
                    what: `The env file ${file} does not exist`,
                    where: "the --env-file option",
                    fix: `create it, correct the path (it is relative to ${cwd}), or use --no-env-file to read none`,
                });
            }
            continue;
        }
        const values = parseEnv(readFileSync(full, "utf8"));
        for (const [key, value] of Object.entries(values)) {
            if (env[key] === undefined && value !== undefined)
                env[key] = value;
        }
        loaded.push(file);
    }
    return loaded;
}
