import type { CookieOptions, ResolvedCookie, SameSite } from "./types";

/** `Set-Cookie`의 `SameSite` 속성에 쓰는 표기. */
const SAME_SITE_LABEL: Record<SameSite, string> = { lax: "Lax", strict: "Strict", none: "None" };

/** 쿠키 이름에 허용되지 않는 문자: 공백·제어문자·구분자(`;`, `=`). */
const INVALID_NAME = /[\s;=]/;

/** `Cookie` 헤더에서 이름이 `name`인 첫 쿠키의 값. 값 안의 `=`는 그대로 둔다. 헤더나 쿠키가 없으면 `undefined`다. */
export function readCookie(header: string | null, name: string): string | undefined {
	const prefix = `${name}=`;
	for (const part of (header ?? "").split(";")) {
		const pair = part.trim();
		if (pair.startsWith(prefix)) return pair.slice(prefix.length);
	}
	return undefined;
}

/** 기본값을 채운 쿠키 옵션. 잘못된 이름·경로·수명이나 `sameSite: "none"` + `secure: false`는 오류를 던진다. */
export function resolveCookie(options: CookieOptions = {}): ResolvedCookie {
	const { name = "monti_session", path = "/", sameSite = "lax", secure, maxAge = 2_592_000 } = options;
	if (name === "" || INVALID_NAME.test(name)) throw new Error("쿠키 설정이 잘못되었다: 올바른 쿠키 이름이 아니다");
	if (path === "" || path.includes(";")) throw new Error("쿠키 설정이 잘못되었다: 올바른 쿠키 경로가 아니다");
	if (!Number.isInteger(maxAge) || maxAge <= 0) throw new Error("쿠키 설정이 잘못되었다: maxAge는 양의 정수여야 한다");
	if (sameSite === "none" && secure === false) {
		throw new Error('쿠키 설정이 잘못되었다: sameSite: "none"은 secure: false와 함께 쓸 수 없다');
	}
	return { name, path, sameSite, secure, maxAge };
}

/** 세션 토큰 `token`을 담는 `HttpOnly` 쿠키의 `Set-Cookie` 헤더 값. */
export function sessionCookie(cookie: ResolvedCookie, token: string, isHttps: boolean): string {
	return cookieHeader(cookie, token, cookie.maxAge, isHttps);
}

/** 세션 쿠키를 빈 값과 `Max-Age=0`으로 곧바로 만료시키는 `Set-Cookie` 헤더 값. */
export function expiredCookie(cookie: ResolvedCookie, isHttps: boolean): string {
	return cookieHeader(cookie, "", 0, isHttps);
}

/** `secure`를 생략하면 HTTPS 요청이거나 `sameSite: "none"`일 때 `Secure`를 붙인다. */
function cookieHeader(cookie: ResolvedCookie, value: string, maxAge: number, isHttps: boolean): string {
	const secure = cookie.secure ?? (isHttps || cookie.sameSite === "none");
	const attributes = `HttpOnly; Path=${cookie.path}; SameSite=${SAME_SITE_LABEL[cookie.sameSite]}; Max-Age=${maxAge}`;
	return `${cookie.name}=${value}; ${attributes}${secure ? "; Secure" : ""}`;
}
