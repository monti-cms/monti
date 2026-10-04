/**
 * 관리자 API 처리기(서버 전용). 앱의 `app/api/cms/[...path]/route.ts`에서 쓴다.
 *
 * ```ts
 * export const { GET, POST, PATCH, PUT, DELETE } = createCmsRouteHandler();
 * ```
 *
 * `next.config.ts`가 읽는 `@monti-cms/core/next`와 나눈 이유: 이 처리기는 서버 설정(`@cms-server`)을 읽으므로
 * Next 설정 파일을 읽는 단계에서 불러오면 안 된다.
 */
export { CMS_ROUTE_PATTERNS, createCmsRouteHandler } from "../http/router";
