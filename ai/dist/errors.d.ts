import { HttpError } from "@monti-cms/core/plugin/server";
/** AI run error. Extends the core API error (`HttpError`) and sets the response status too. */
export type AiErrorCode = "ai_unavailable" | "ai_failed" | "ai_input_too_large" | "ai_rate_limited"
/** An action name that is not in the config. */
 | "ai_unknown_action"
/** The edited value or input does not match the action definition. */
 | "ai_invalid_input";
export declare class AiError extends HttpError {
    readonly code: AiErrorCode;
    constructor(code: AiErrorCode, message: string);
}
