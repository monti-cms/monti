import { HttpError } from "@monti-cms/core/plugin/server";
const STATUS = {
    ai_unavailable: 503,
    ai_failed: 502,
    ai_input_too_large: 413,
    ai_rate_limited: 429,
    ai_unknown_action: 404,
    ai_invalid_input: 400,
};
export class AiError extends HttpError {
    constructor(code, message) {
        super(STATUS[code], code, message);
        this.name = "AiError";
    }
}
