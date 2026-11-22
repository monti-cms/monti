import type { CookieOptions, ResolvedCookie, SameSite } from "./types";

/** `Set-Cookie`의 `SameSite` 속성에 쓰는 표기. */
const SAME_SITE_LABEL: Record<SameSite, string> = { lax: "Lax", strict: "Strict", none: "None" };

/** `Cookie` 헤더에서 이름이 `name`인 첫 쿠키의 값. 값 안의 `=`는 그대로 둔다. 헤더나 쿠키가 없으면 `undefined`다. */
export function readCookie(header: string | null, name: string): string | undefined {
	const prefix = `${name}=`;
	for (const part of (header ?? "").split(";")) {
		const pair = part.trim();
		if (pair.startsWith(prefix)) return pair.slice(prefix.length);
	}
	return undefined;
}

/** 기본값을 채운 쿠키 옵션. `sameSite: "none"`인데 `secure: false`면 브라우저가 버릴 쿠키라 오류를 던진다. */
export function resolveCookie(options: CookieOptions = {}): ResolvedCookie {
	const { name = "monti_session", path = "/", sameSite = "lax", secure, maxAge = 2_592_000 } = options;
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
