export interface MigrateOptions {
    readonly cwd: string;
    /** Env files to read. If unset, `.env.local` and `.env` (only those that exist); an empty array reads none. */
    readonly envFiles?: readonly string[];
    readonly config?: string;
    readonly server?: string;
    readonly log?: (message: string) => void;
}
/**
 * `monti migrate`: reads env files, points the config aliases (`@cms-config`, `@cms-server`) at the app's files, then creates the tables in the store.
 * TypeScript config files are read by tsx, which the command (`bin/monti.mjs`) registers first. Returns `true` on success.
 */
export declare function migrate(options: MigrateOptions): Promise<boolean>;
