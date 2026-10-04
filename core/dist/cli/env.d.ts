/** Files read when `--env-file` is not given (same order as Next: `.env.local` comes before `.env`). */
export declare const DEFAULT_ENV_FILES: readonly [".env.local", ".env"];
/**
 * Reads env files into `env`. **Never overrides an existing value** (values from the shell win, and earlier files win).
 * Returns the files read (paths relative to `cwd`). Missing default files are skipped; a missing explicitly chosen file is an error.
 */
export declare function loadEnvFiles(cwd: string, files: readonly string[] | undefined, env?: Record<string, string | undefined>): string[];
