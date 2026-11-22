/** 쿠키 `SameSite` 속성 값. */
export type SameSite = "lax" | "strict" | "none";

export interface CookieOptions {
	/** 세션 쿠키 이름 (기본: `"monti_session"`). */
	name?: string;
	/** 쿠키 `Path` 속성 (기본: `"/"`). */
	path?: string;
	/** 쿠키 `SameSite` 속성 (기본: `"lax"`). `"none"`이면 `Secure`를 자동으로 강제한다. */
	sameSite?: SameSite;
	/**
	 * `Secure` 속성. 생략하면 요청 URL이 `https:`이거나 `sameSite === "none"`일 때 붙인다. 리버스 프록시 앞단에서 TLS가
	 * 종료되어 요청 URL이 `http:`로 들어오는 운영 환경에서는 `true`를 명시한다.
	 */
	secure?: boolean;
	/** 쿠키 `Max-Age` 초 (기본: `2_592_000`, core 세션 수명 30일과 동일). */
	maxAge?: number;
}

export interface HttpHandlerOptions {
	/** 핸들러가 마운트된 접두 경로 (기본: `"/api"`). `""` 또는 `"/"`면 루트 기준 매칭. */
	basePath?: string;
	/**
	 * 세션 쿠키 설정. `HttpOnly`는 항상 강제되며 끌 수 없다. `sameSite: "none"`과 `secure: false`를 함께 지정하면 핸들러
	 * 생성 시 오류를 던진다.
	 */
	cookie?: CookieOptions;
}

export type HttpHandler = (request: Request) => Promise<Response>;

/** 모든 오류 응답의 JSON 본문. `details`는 값이 `undefined`가 아닐 때만 들어간다. */
export interface HttpErrorBody {
	error: { code: string; message: string; details?: unknown };
}

/** 기본값을 채운 쿠키 옵션. `secure`가 `undefined`면 요청마다 HTTPS 여부로 정한다. */
export interface ResolvedCookie {
	name: string;
	path: string;
	sameSite: SameSite;
	secure: boolean | undefined;
	maxAge: number;
}

/** 성공 응답의 상태 코드. `204`는 본문이 없다. */
export type SuccessStatus = 200 | 201 | 204;
