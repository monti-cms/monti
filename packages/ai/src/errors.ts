import { CmsError, type ErrorCode } from "@monti-cms/core/server";

/**
 * The codes an AI run answers with, all of them core codes (the status of each is in the core table):
 * `service_unavailable` (no connection or key), `upstream_failed` (the provider failed), `payload_too_large`, `rate_limited`,
 * `not_found` (an action name that is not in the config) and `invalid_input` (the edited value or input does not match the action definition).
 */
export type AiErrorCode = Extract<
	ErrorCode,
	"service_unavailable" | "upstream_failed" | "payload_too_large" | "rate_limited" | "not_found" | "invalid_input"
>;

export interface AiErrorOptions {
	/** What to do about it, in the admin language. */
	readonly fix?: string;
	/** The raw words underneath (the provider's answer, a parser or schema message). The person sees them only behind "details". */
	readonly detail?: string;
	readonly issues?: readonly unknown[];
}

/**
 * An AI run that cannot be done. `what` (and `fix`) are the person's text in the admin language, from a dictionary; raw text from the provider, the
 * MDX parser or a schema goes in `detail`, never into `what`.
 */
export class AiError extends CmsError {
	declare readonly code: AiErrorCode;

	constructor(code: AiErrorCode, what: string, options: AiErrorOptions = {}) {
		// The developer message is the raw words when there are any (the answer's `detail`), else the person's text.
		super(options.detail ?? what, code, {
			issues: options.issues,
			notice: { what, ...(options.fix ? { fix: options.fix } : {}) },
		});
		this.name = "AiError";
	}

	/** The raw words underneath, when there are any. */
	get detail(): string | undefined {
		const notice = this.notice;
		return notice && "what" in notice && this.message === notice.what ? undefined : this.message;
	}
}
