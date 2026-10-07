import type { Cms } from "../cms";

/**
 * Checks for `monti doctor`. Anything that knows a way a setup can go wrong contributes checks: a server plugin (`CmsServerPlugin.checks`), and the database,
 * login and media adapters (`checks` of `DatabaseAdapter`, `AuthAdapter` and `MediaAdapter`). `monti doctor` loads the app, runs every check and prints the
 * outcome of each as ok, warn or fail.
 *
 * A check says what it found, where (a file, an environment variable or an option), and for a warn or a fail how to fix it, in plain words. It never changes
 * anything, and it never prints a secret.
 */

/**
 * `ok`: as it should be. `warn`: works, but something should change. `fail`: the app (or a feature) will not work. `skip`: could not be checked, because an
 * earlier problem blocks it or because it needs `--online`.
 */
export type CheckStatus = "ok" | "warn" | "fail" | "skip";

/** What a check found. */
export interface CheckOutcome {
	readonly status: CheckStatus;
	/** What was found, in one plain sentence. */
	readonly message: string;
	/** Where it is: a file, an environment variable, or an option of the config. */
	readonly where?: string;
	/** What to do about it (for a warn or a fail): the next step, with the exact command or value when there is one. */
	readonly fix?: string;
}

/** What a check can use. */
export interface DoctorContext {
	/** The app's instance, loaded from `monti.config.ts`. */
	readonly cms: Cms;
	/** The app folder. */
	readonly cwd: string;
	/** The environment the app runs with: the shell's values plus the env files `monti doctor` read. */
	readonly env: Readonly<Record<string, string | undefined>>;
	/** Whether `--online` was given. A check that makes a network call sets `online: true` and runs only then. */
	readonly online: boolean;
}

export interface DoctorCheck {
	/** Short name, lowercase letters, digits and `-`. Reported as `<owner>/<id>` (`git-sync/token`). */
	readonly id: string;
	/** What the check looks at, in a few words (`GitHub token`). */
	readonly title: string;
	/** `true` for a check that calls out over the network (a repo, a bucket). It is skipped unless `monti doctor --online` is given. */
	readonly online?: boolean;
	/** Runs the check. Throwing counts as a fail with the error's message. */
	run(context: DoctorContext): CheckOutcome | Promise<CheckOutcome>;
}

type Details = Pick<CheckOutcome, "where" | "fix">;

/** Everything is as it should be. */
export const ok = (message: string, details: Pick<CheckOutcome, "where"> = {}): CheckOutcome => ({
	status: "ok",
	message,
	...details,
});

/** Works, but something should change. Say how in `fix`. */
export const warn = (message: string, details: Details = {}): CheckOutcome => ({ status: "warn", message, ...details });

/** Broken: the app (or a feature) will not work. Say how to fix it in `fix`. */
export const fail = (message: string, details: Details = {}): CheckOutcome => ({ status: "fail", message, ...details });

/** Could not be checked, because an earlier problem blocks it. Not a failure: say what blocks it. */
export const skip = (message: string): CheckOutcome => ({ status: "skip", message });
