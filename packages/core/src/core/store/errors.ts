import type { ErrorCode } from "../error-codes";

/**
 * The one error the server code throws for a request it cannot do. `code` is an {@link ErrorCode}, so the HTTP status comes from one table and
 * the response has one shape: `{ error: { code, message, issues?, details? } }`.
 */
export class CmsError extends Error {
	public readonly code: ErrorCode;
	/** The version the server holds, for a `conflict`: the caller can reload and retry. It reaches the response as `details.serverVersion`. */
	public readonly serverVersion?: number;
	public readonly details?: unknown;
	/** Problems found in the request (the issues of a validation), when the code is about the content. */
	public readonly issues?: readonly unknown[];

	constructor(
		message: string,
		code: ErrorCode,
		serverVersion?: number,
		details?: unknown,
		issues?: readonly unknown[],
	) {
		super(message);
		this.code = code;
		this.serverVersion = serverVersion;
		this.details = details;
		this.issues = issues;
		this.name = "CmsError";
	}
}
