import { HttpError } from "@monti-cms/core/plugin/server";

/** AI 실행 오류. 본체 API 오류(`HttpError`)를 이어 응답 코드를 함께 정한다. */
export type AiErrorCode =
	| "ai_unavailable"
	| "ai_failed"
	| "ai_input_too_large"
	| "ai_rate_limited"
	/** 설정에 없는 기능 이름. */
	| "ai_unknown_action"
	/** 고친 값·입력이 기능 정의에 맞지 않는다. */
	| "ai_invalid_input";

const STATUS: Record<AiErrorCode, number> = {
	ai_unavailable: 503,
	ai_failed: 502,
	ai_input_too_large: 413,
	ai_rate_limited: 429,
	ai_unknown_action: 404,
	ai_invalid_input: 400,
};

export class AiError extends HttpError {
	declare readonly code: AiErrorCode;

	constructor(code: AiErrorCode, message: string) {
		super(STATUS[code], code, message);
		this.name = "AiError";
	}
}
