import { type DoctorReport } from "./format.js";
export interface DoctorOptions {
    /** The app folder. */
    readonly cwd: string;
    /** Env files to read. If unset, `.env.local` and `.env` (only those that exist); an empty array reads none. */
    readonly envFiles?: readonly string[];
    /** Config file (`monti.config.ts`). */
    readonly config?: string;
    /** Run only these checks: a group (`database`, `auth`) or one check (`database/migrations`). */
    readonly only?: readonly string[];
    /** The environment to read and fill from the env files. Default `process.env`: the config file reads that one when it loads. */
    readonly env?: Record<string, string | undefined>;
}
/**
 * `monti doctor`: reads the env files, finds and loads the config file, then runs the checks of core (config, schema, database, secrets, login settings, Next files, upgrade), and returns what each found. It changes nothing, and never prints a secret. The instance it loads is closed before it returns.
 */
export declare function runDoctor(options: DoctorOptions): Promise<DoctorReport>;
