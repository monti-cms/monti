import type { ErrorCode } from "@monti-cms/core";
import type { HttpErrorBody, SuccessStatus } from "./types";

const JSON_TYPE = "application/json; charset=utf-8";
const NO_STORE = "no-store";
const FALLBACK_ERROR_BODY = '{"error":{"code":"INTERNAL_ERROR","message":"서버 내부 오류가 발생했다"}}';

/** 코어 `ErrorCode`마다 HTTP 상태 코드. */
const ERROR_STATUS: Record<ErrorCode, number> = {
	BAD_REQUEST: 400,
	UNAUTHORIZED: 401,
	FORBIDDEN: 403,
	NOT_FOUND: 404,
	CONFLICT: 409,
};

/** 코어 오류의 모양. 다른 경계에서 만든 오류도 받도록 `instanceof` 대신 `code`·`message` 모양으로 알아본다. */
interface CoreError {
	code: ErrorCode;
	message: string;
	details?: unknown;
}

/** 성공 응답. `204`는 본문과 `Content-Type` 없이, 그 밖은 `data`를 안전하게 직렬화한 JSON 본문으로 만든다. */
export function successResponse(status: SuccessStatus, data: unknown, setCookie?: string): Response {
	const headers = new Headers({ "cache-control": NO_STORE });
	if (setCookie !== undefined) headers.set("set-cookie", setCookie);
	if (status === 204) return new Response(null, { status, headers });
	headers.set("content-type", JSON_TYPE);
	return new Response(safeJson(data), { status, headers });
}

/** 던져진 값의 오류 응답. 코어 오류는 대응하는 상태로, 그 밖이나 직렬화 실패는 내부 상세를 숨긴 `500`으로 만든다. */
export function errorResponse(error: unknown): Response {
	try {
		if (!isCoreError(error)) return errorJson(500, { code: "INTERNAL_ERROR", message: "서버 내부 오류가 발생했다" });
		const { code, message, details } = error;
		return errorJson(ERROR_STATUS[code], { code, message, details });
	} catch {
		return new Response(FALLBACK_ERROR_BODY, {
			status: 500,
			headers: { "content-type": JSON_TYPE, "cache-control": NO_STORE },
		});
	}
}

/** 열려 있지 않은 메서드의 `405` 응답. `Allow` 헤더에 허용 메서드를 순서대로 담는다. */
export function methodNotAllowedResponse(allow: readonly string[]): Response {
	const response = errorJson(405, { code: "METHOD_NOT_ALLOWED", message: "허용되지 않은 메서드다" });
	response.headers.set("allow", allow.join(", "));
	return response;
}

function errorJson(status: number, error: HttpErrorBody["error"]): Response {
	const body: HttpErrorBody = { error };
	return new Response(safeJson(body), { status, headers: { "content-type": JSON_TYPE, "cache-control": NO_STORE } });
}

function isCoreError(error: unknown): error is CoreError {
	const candidate = Object(error);
	return (
		typeof candidate.code === "string" &&
		typeof candidate.message === "string" &&
		Object.hasOwn(ERROR_STATUS, candidate.code)
	);
}

/**
 * `value`의 JSON. 최상위가 직렬화할 수 없는 값(함수·`undefined`)이면 `"null"`이다. 안의 함수는 빠지고 큰 정수는
 * 글자로 쓴다. 조상 경로의 순환 참조(`toJSON()` 이전 원본 포함)만 그 자리를 비워 끊고 공유 참조는 그대로 쓴다.
 */
function safeJson(value: unknown): string {
	return JSON.stringify(value, jsonSafe()) ?? "null";
}

function isTracked(target: unknown, originals: unknown[], holders: unknown[]): boolean {
	return target !== null && typeof target === "object" && (originals.includes(target) || holders.includes(target));
}

/** `JSON.stringify`의 replacer: 변환 전후 객체가 조상 가운데 하나이면 빼서 순환을 끊고, `bigint`는 글자로 바꾼다. */
function jsonSafe(): (this: Record<string, unknown>, key: string, value: unknown) => unknown {
	const holders: unknown[] = [];
	const originals: unknown[] = [];
	return function replace(this: Record<string, unknown>, key: string, value: unknown): unknown {
		const depth = holders.lastIndexOf(this) + 1;
		holders.length = depth;
		originals.length = depth;
		const original = this[key];
		if (isTracked(original, originals, holders) || isTracked(value, originals, holders)) return undefined;
		const safe = typeof value === "bigint" ? value.toString() : value;
		holders.push(safe);
		originals.push(original);
		return safe;
	};
}
