import { type CoreMonti, MontiError } from "@monti-cms/core";
import { expiredCookie, sessionCookie } from "../protocol/cookie";
import type { ResolvedCookie } from "../protocol/types";

/** 로그인 없이 부를 수 있는 Operation: 최초 관리자 생성, 로그인, 현재 세션 조회. */
const PUBLIC_OPERATIONS = new Set(["admin.create", "session.create", "session.get"]);

/** 쿠키의 세션 토큰을 입력 `token`으로 받는 Operation. 본문이나 쿼리의 `token`보다 쿠키가 우선한다. */
const TOKEN_OPERATIONS = new Set(["session.get", "session.delete"]);

/** 성공하면 세션 쿠키를 발급하는 Operation. 반환값의 토큰 원문은 응답 본문에서 뺀다. */
const ISSUING_OPERATIONS = new Set(["session.create", "admin.create"]);

/** 성공하면 세션 쿠키를 만료 삭제하는 Operation. */
const CLEARING_OPERATIONS = new Set(["session.delete", "admin.update"]);

/** 응답에 쿠키를 붙일 때 필요한 것. 시험 실행이면 쿠키를 설정·삭제하지 않는다. */
export interface CookieContext {
	cookie: ResolvedCookie;
	isHttps: boolean;
	dryRun: boolean;
}

/** 응답 본문과, 붙일 `Set-Cookie` 헤더 값(없으면 `undefined`). */
interface Outcome {
	body: unknown;
	setCookie: string | undefined;
}

/** 공개 Operation이 아니면 쿠키의 세션 토큰이 유효한 세션인지 확인한다. 토큰이 없거나 세션이 없으면 `UNAUTHORIZED`다. */
export async function authorize(monti: CoreMonti, operation: string, token: string | undefined): Promise<void> {
	if (PUBLIC_OPERATIONS.has(operation)) return;
	if (token === undefined || (await monti.session.get({ token })).admin === null) {
		throw new MontiError("UNAUTHORIZED", "로그인이 필요하다");
	}
}

/** 세션 토큰을 받는 Operation이면 입력에 쿠키의 토큰을 넣는다. */
export function withToken(
	operation: string,
	input: Record<string, unknown>,
	token: string | undefined,
): Record<string, unknown> {
	return TOKEN_OPERATIONS.has(operation) ? { ...input, token } : input;
}

/**
 * Operation의 반환값을 응답 본문과 `Set-Cookie`로: 로그인은 `{ ok: true }`, 최초 관리자 생성은 토큰을 뺀 계정 정보를
 * 본문으로 하고 세션 쿠키를 발급한다. 로그아웃과 관리자 계정 변경은 세션 쿠키를 만료 삭제한다.
 */
export function cookieOutcome(operation: string, output: unknown, context: CookieContext): Outcome {
	const { cookie, isHttps, dryRun } = context;
	if (ISSUING_OPERATIONS.has(operation)) {
		const { token, ...account } = Object(output);
		const body = operation === "session.create" ? { ok: true } : account;
		return { body, setCookie: dryRun ? undefined : sessionCookie(cookie, token, isHttps) };
	}
	const clears = CLEARING_OPERATIONS.has(operation) && !dryRun;
	return { body: output, setCookie: clears ? expiredCookie(cookie, isHttps) : undefined };
}
