/**
 * 사이트 설정을 읽지 않는 주소 규칙(`basePath`·관리자 API 주소). 서버 설정(`cms.server.ts`)이 쓰는 어댑터도 읽으므로
 * 설정을 불러오는 모듈을 import하지 않는다.
 */

/** 관리자 API 경로 머리(`app/api/cms/[...path]/route.ts` 위치). */
export const CMS_API_PATH = "/api/cms";

/** `basePath` 값을 `""`(없음) 또는 `/폴더`(앞 `/` 있고 끝 `/` 없음)로 고른다. */
export function normalizeBasePath(value: string | undefined | null): string {
	const trimmed = (value ?? "").trim().replace(/\/+$/, "");
	if (trimmed === "") return "";
	return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

/**
 * 앱이 하위 경로에 올라가 있을 때(Next `basePath`) 그 경로. 없으면 `""`. `withCms`가 Next 설정의 `basePath`를
 * 서버·브라우저 번들 모두에 심어 주므로 사이트 코드는 아무것도 하지 않는다.
 * 호출할 때마다 읽는다(번들러가 아래 식을 값으로 바꾸고, 테스트는 환경 변수를 바꿔 볼 수 있다).
 */
export function cmsBasePath(): string {
	try {
		return normalizeBasePath(process.env.NEXT_PUBLIC_CMS_BASE_PATH);
	} catch {
		return "";
	}
}

/**
 * 브라우저가 실제로 여는 주소(`basePath` 포함). `path`는 `/…`다.
 * Next의 `Link`·`router`·`redirect()`는 `basePath`를 스스로 붙이므로 그쪽에는 쓰지 않는다(이중으로 붙는다) —
 * `fetch`·`window.open`·`history`·로그인 `redirectTo`처럼 Next가 손대지 않는 곳에 쓴다.
 */
export const withBasePath = (path: string): string => `${cmsBasePath()}${path}`;

/**
 * 관리자 API 주소. `cmsApiUrl("/v1/entries?page=2")`는 `/api/cms/v1/entries?page=2`(`basePath`가 있으면 그 앞에 붙는다).
 * 관리자 화면·확장의 모든 API 호출은 이 함수로 주소를 만든다.
 */
export function cmsApiUrl(path: string): string {
	if (!path.startsWith("/")) throw new Error(`cmsApiUrl: "${path}" must start with "/"`);
	return withBasePath(`${CMS_API_PATH}${path}`);
}

/** 설정을 읽지 않는 관리자 주소 규칙. `path`는 빈 글자·`/…`·`?…`다. */
export function adminHrefWith(base: string, path = ""): string {
	if (path !== "" && !path.startsWith("/") && !path.startsWith("?")) {
		throw new Error(`adminHref: "${path}" must start with "/" or "?"`);
	}
	return `${base}${path === "/" ? "" : path}`;
}
