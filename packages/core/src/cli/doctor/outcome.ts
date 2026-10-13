import type { Problem } from "../../core/problem";

/**
 * What a `monti doctor` check reports. A check says what it found, where (a file, an environment variable or an option), and for a warn or a fail how to fix
 * it, in plain words. It never changes anything, and it never prints a secret.
 */

/**
 * `ok`: as it should be. `warn`: works, but something should change. `fail`: the app (or a feature) will not work. `skip`: could not be checked, because an
 * earlier problem blocks it.
 */
export type CheckStatus = "ok" | "warn" | "fail" | "skip";

/**
 * What a check found. Beside the status, the finding is a {@link Problem} told the way core's own setup errors tell it: `message` is its `what`, and `where` and `fix`
 * are the same parts with the same meaning. A check that is `ok` or skipped has nothing to fix, so `fix` is optional here.
 */
export interface CheckOutcome extends Partial<Pick<Problem, "where" | "fix">> {
	readonly status: CheckStatus;
	/** What was found, in one plain sentence (a `Problem`'s `what`). */
	readonly message: string;
}

type Details = Partial<Pick<Problem, "where" | "fix">>;

/** A warn or a fail that tells a {@link Problem} an error already carries (a `SetupError`'s `problem`). */
export const fromProblem = (status: "warn" | "fail", problem: Problem): CheckOutcome => ({
	status,
	message: problem.what,
	...(problem.where ? { where: problem.where } : {}),
	fix: problem.fix,
});
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
