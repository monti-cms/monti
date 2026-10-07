/**
 * The wording of a setup problem, shared by the errors core and the plugins throw and by `monti doctor`: what is wrong, where it is, and how to fix it.
 * Each part is plain words. `where` names a file, an environment variable or an option; `fix` is the next step, with the exact command or value when there is one.
 */
export interface Problem {
	/** What is wrong, in one plain sentence (no trailing period needed). */
	readonly what: string;
	/** Where it is: a file, an environment variable, or an option of the config. */
	readonly where?: string;
	/** What to do about it. */
	readonly fix: string;
}

const sentence = (text: string): string => {
	const trimmed = text.trim();
	return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
};

/**
 * The problem as one line of text for an error message: `<what>. Where: <where>. Fix: <fix>`. Tests and tools can look for the `Where:` and `Fix:` markers.
 *
 * ```ts
 * throw problemError({ what: "DATABASE_URL is not set", where: ".env.local", fix: "put your Postgres URL in it" });
 * // DATABASE_URL is not set. Where: .env.local. Fix: put your Postgres URL in it.
 * ```
 */
export function problemText(problem: Problem): string {
	const parts = [sentence(problem.what)];
	if (problem.where) parts.push(`Where: ${sentence(problem.where)}`);
	parts.push(`Fix: ${sentence(problem.fix)}`);
	return parts.join(" ");
}

/**
 * A mistake in how the site is set up (a missing setting, a database that is not migrated), not a bug: the message is {@link problemText}. The HTTP layer answers
 * it with a 503 and a pointer to the server log, where the full message is printed, instead of a bare "Internal server error".
 */
export class SetupError extends Error {
	constructor(
		readonly problem: Problem,
		options?: { readonly cause?: unknown; readonly kind?: string },
	) {
		super(problemText(problem), options?.cause === undefined ? undefined : { cause: options.cause });
		this.name = "SetupError";
		this.kind = options?.kind ?? "setup_required";
		// An error that explains a driver error keeps the driver's `code` (`42P01`, `ECONNREFUSED`), so code that tells those apart still works.
		const driverCode = (options?.cause as { code?: unknown } | null | undefined)?.code;
		this.code = typeof driverCode === "string" ? driverCode : this.kind;
	}
	/** Stable name of the kind of problem (`database_unreachable`, `migrations_pending`, ...). */
	readonly kind: string;
	/** The driver's error code when this explains a driver error, else the same as `kind`. */
	readonly code: string;
}

/** A {@link SetupError} for the problem. `cause` keeps the error underneath (a driver error, say); `kind` names the kind of problem. */
export function problemError(problem: Problem, cause?: unknown, kind?: string): SetupError {
	return new SetupError(problem, { cause, kind });
}
