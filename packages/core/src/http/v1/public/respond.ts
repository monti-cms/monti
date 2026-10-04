import { NextResponse } from "next/server";
import { CmsError } from "../../../adapters/postgres/store/errors";

/** 공개 응답은 캐시하지 않는다(오류도: CDN이 404를 보관하면 발행 직후에도 404가 남는다). */
const NO_STORE = { "Cache-Control": "no-store" } as const;

export const publicJson = (body: unknown) => NextResponse.json(body, { headers: NO_STORE });

export const publicError = (code: "invalid_input" | "not_found", message: string) =>
	NextResponse.json({ code, message }, { status: code === "not_found" ? 404 : 400, headers: NO_STORE });

/** 400·404·503만 쓴다. 내부 메시지는 응답에 넣지 않고 DB·설정 오류는 404로 숨기지 않는다(503, 로그에만 원인). */
export function publicApiError(error: unknown): NextResponse {
	if (error instanceof CmsError) {
		if (error.code === "not_found") return publicError("not_found", "Not found");
		if (error.code === "invalid_input") return publicError("invalid_input", error.message);
	}
	console.error("[cms] public API error:", error);
	return NextResponse.json(
		{ code: "unavailable", message: "Public content is temporarily unavailable" },
		{ status: 503, headers: NO_STORE },
	);
}
