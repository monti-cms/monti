import { NextResponse } from "next/server";
import { AuthError } from "../../adapters/auth";
import { CmsError } from "../../adapters/postgres/content-store";
import { ServiceError } from "../../services/types";

/**
 * 라우트가 직접 만드는 HTTP 오류(요청 형식·버전 누락 등). 플러그인 오류도 이 오류를 이어 상태 코드를 정한다.
 * 응답 모양은 다른 오류와 같다: `code`, `message`, 필요하면 `issues`(§10.1).
 */
export class HttpError extends Error {
	constructor(
		readonly status: number,
		readonly code: string,
		message: string,
		readonly issues?: unknown,
	) {
		super(message);
		this.name = "HttpError";
	}
}

const CMS_ERROR_STATUS: Record<string, number> = {
	not_found: 404,
	conflict: 409,
	slug_conflict: 409,
	in_use: 409,
	invalid_status: 409,
	locked: 409,
	folder_name_conflict: 409,
	translation_exists: 409,
	has_translations: 409,
	source_trashed: 409,
	invalid_input: 400,
	invalid_reference: 400,
	invalid_state: 500,
	media_not_configured: 501,
};

const SERVICE_ERROR_STATUS: Record<string, number> = {
	invalid_input: 400,
	unknown_collection: 400,
	slug_reserved: 409,
	mdx_too_large: 413,
	metadata_too_large: 413,
};

/** DB 연결 장애는 일시 오류(503)다. 없는 콘텐츠나 빈 목록으로 위장하지 않는다(§10.1, §11.1). */
const isUnavailable = (error: unknown) => {
	const code = (error as { code?: unknown })?.code;
	return (
		typeof code === "string" &&
		(code === "ECONNREFUSED" ||
			code === "ETIMEDOUT" ||
			code === "ENOTFOUND" ||
			code === "57P01" ||
			code.startsWith("08"))
	);
};

export function handleApiError(error: unknown): NextResponse {
	if (error instanceof HttpError) {
		return NextResponse.json(
			{ code: error.code, message: error.message, ...(error.issues ? { issues: error.issues } : {}) },
			{ status: error.status },
		);
	}

	if (error instanceof AuthError) {
		return NextResponse.json(
			{ code: error.code, message: error.message },
			{ status: error.code === "unauthorized" ? 401 : 403 },
		);
	}

	if (error instanceof CmsError) {
		const status = CMS_ERROR_STATUS[error.code] ?? 400;
		if (status === 500) console.error("CMS store invariant broken:", error);
		return NextResponse.json(
			{
				code: error.code,
				message: status === 500 ? "Internal server error" : error.message,
				...(error.serverVersion !== undefined ? { serverVersion: error.serverVersion } : {}),
				...(error.details !== undefined ? { details: error.details } : {}),
			},
			{ status },
		);
	}

	if (error instanceof ServiceError) {
		return NextResponse.json(
			{ code: error.code, message: error.message, ...(error.issues ? { issues: error.issues } : {}) },
			{ status: SERVICE_ERROR_STATUS[error.code] ?? 422 },
		);
	}

	// 화면이 요청을 거둬들인 경우(모델 목록을 다시 불러오는 등). 받을 쪽이 없으니 조용히 끝낸다.
	if (isClientAbort(error)) return new NextResponse(null, { status: 499 });

	if (isUnavailable(error)) {
		console.error("CMS storage unavailable:", error);
		return NextResponse.json({ code: "unavailable", message: "Storage is temporarily unavailable" }, { status: 503 });
	}

	console.error("Unhandled API error:", error);
	return NextResponse.json({ code: "internal_error", message: "Internal server error" }, { status: 500 });
}

/** 브라우저가 요청을 끊어 본문을 끝까지 읽지 못했거나, 요청 신호로 멈춘 작업. */
function isClientAbort(error: unknown): boolean {
	if (!error || typeof error !== "object") return false;
	// DOMException은 실행 환경에 따라 Error를 잇지 않는다. 이름으로 본다.
	const { name, code, message } = error as { name?: unknown; code?: unknown; message?: unknown };
	return name === "AbortError" || (code === "ECONNRESET" && message === "aborted");
}
