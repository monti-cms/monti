/**
 * What a `monti doctor` check reports. A check says what it found, where (a file, an environment variable or an option), and for a warn or a fail how to fix
 * it, in plain words. It never changes anything, and it never prints a secret.
 */
/**
 * `ok`: as it should be. `warn`: works, but something should change. `fail`: the app (or a feature) will not work. `skip`: could not be checked, because an
 * earlier problem blocks it.
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
type Details = Pick<CheckOutcome, "where" | "fix">;
/** Everything is as it should be. */
export declare const ok: (message: string, details?: Pick<CheckOutcome, "where">) => CheckOutcome;
/** Works, but something should change. Say how in `fix`. */
export declare const warn: (message: string, details?: Details) => CheckOutcome;
/** Broken: the app (or a feature) will not work. Say how to fix it in `fix`. */
export declare const fail: (message: string, details?: Details) => CheckOutcome;
/** Could not be checked, because an earlier problem blocks it. Not a failure: say what blocks it. */
export declare const skip: (message: string) => CheckOutcome;
export {};
