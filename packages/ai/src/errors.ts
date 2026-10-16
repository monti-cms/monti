import { CmsError, type ErrorCode } from "@monti-cms/core/plugin/server";

/**
 * The codes an AI run answers with, all of them core codes (the status of each is in the core table):
 * `service_unavailable` (no connection or key), `upstream_failed` (the provider failed), `payload_too_large`, `rate_limited`,
 * `not_found` (an action name that is not in the config) and `invalid_input` (the edited value or input does not match the action definition).
 */
export type AiErrorCode = Extract<
	ErrorCode,
	"service_unavailable" | "upstream_failed" | "payload_too_large" | "rate_limited" | "not_found" | "invalid_input"
>;

export class AiError extends CmsError {
	declare readonly code: AiErrorCode;

	constructor(code: AiErrorCode, message: string, issues?: readonly unknown[]) {
		super(message, code, undefined, undefined, issues);
		this.name = "AiError";
	}
}
