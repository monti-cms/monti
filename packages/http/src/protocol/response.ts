import type { ErrorCode } from "@monti-cms/core";
import type { HttpErrorBody, SuccessStatus } from "./types";

const JSON_TYPE = "application/json; charset=utf-8";

/** 코어 `ErrorCode`마다 HTTP 상태 코드. */
const ERROR_STATUS: Record<ErrorCode, number> = {
	BAD_REQUEST: 400,
	UNAUTHORIZED: 401,
	FORBIDDEN: 403,
	NOT_FOUND: 404,
	CONFLICT: 409,
};

/** 코어 오류의 모양. 다른 경계에서 만든 오류도 받도록 `instanceof` 대신 `code`가 코어 `ErrorCode`인지로 알아본다. */
interface CoreError {
	code: ErrorCode;
	message: string;
	details?: unknown;
}

/** 성공 응답. `204`는 본문과 `Content-Type` 없이, 그 밖은 `data`를 안전하게 직렬화한 JSON 본문으로 만든다. */
export function successResponse(status: SuccessStatus, data: unknown, setCookie?: string): Response {
	const headers = new Headers();
	if (setCookie !== undefined) headers.set("set-cookie", setCookie);
	if (status === 204) return new Response(null, { status, headers });
	headers.set("content-type", JSON_TYPE);
	return new Response(safeJson(data), { status, headers });
}

/** 던져진 값의 오류 응답. 코어 오류는 대응하는 상태로, 그 밖은 내부 상세를 숨긴 `500`으로 만든다. */
export function errorResponse(error: unknown): Response {
	if (!isCoreError(error)) return errorJson(500, { code: "INTERNAL_ERROR", message: "서버 내부 오류가 발생했다" });
	const { code, message, details } = error;
	return errorJson(ERROR_STATUS[code], { code, message, details });
}

/** 열려 있지 않은 메서드의 `405` 응답. `Allow` 헤더에 허용 메서드를 순서대로 담는다. */
export function methodNotAllowedResponse(allow: readonly string[]): Response {
	const response = errorJson(405, { code: "METHOD_NOT_ALLOWED", message: "허용되지 않은 메서드다" });
	response.headers.set("allow", allow.join(", "));
	return response;
}

function errorJson(status: number, error: HttpErrorBody["error"]): Response {
	const body: HttpErrorBody = { error };
	return new Response(safeJson(body), { status, headers: { "content-type": JSON_TYPE } });
}

function isCoreError(error: unknown): error is CoreError {
	return Object.hasOwn(ERROR_STATUS, Object(error).code);
}

/**
 * `value`의 JSON. 함수는 `JSON.stringify`처럼 빠지고 큰 정수(`bigint`)는 글자로 쓴다. 조상 경로의 순환 참조만 그 자리를
 * 비워 끊고, 순환이 아닌 공유 참조(여러 곳에서 가리키는 같은 객체)는 가리키는 곳마다 그대로 쓴다.
 */
function safeJson(value: unknown): string {
	return JSON.stringify(value, jsonSafe());
}

/** `JSON.stringify`의 replacer: 지금 값이 그 조상 가운데 하나이면 빼서 순환을 끊고, `bigint`는 글자로 바꾼다. */
function jsonSafe(): (this: unknown, key: string, value: unknown) => unknown {
	/** 뿌리에서 지금 값까지 거쳐 온 값(replacer가 돌려준 것). `this`가 몇 번째 조상인지 찾는 데 쓴다. */
	const holders: unknown[] = [];
	return function replace(this: unknown, _key: string, value: unknown): unknown {
		// `this`는 지금 값을 담은 객체다. 그 뒤에 쌓인 것(앞서 끝난 형제 값의 경로)을 덜어 내면 지금 값의 조상만 남는다.
		holders.length = holders.lastIndexOf(this) + 1;
		if (holders.includes(value)) return undefined;
		const safe = typeof value === "bigint" ? value.toString() : value;
		holders.push(safe);
		return safe;
	};
}
