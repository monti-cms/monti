import { getCmsAuth } from "../../container";
import { type AuthGateway, CmsAuthGateway } from "./auth-gateway";

/**
 * 관리자 로그인 실행 API. 서버 설정(`cms.server.ts`)의 `auth`로 만든 연결을 쓴다.
 * 로그인 방식을 고르는 쪽(`githubAuth`)은 `@monti-cms/core/server`에 있다.
 */
export { type AuthContext, AuthError, type AuthGateway } from "./auth-gateway";

export const authGateway: AuthGateway = new CmsAuthGateway(getCmsAuth);

/** 로그인 API 라우트 처리기. 로그인 경로를 기본(`/api/cms/auth`)과 다르게 둔 앱이 그 경로의 라우트 파일에서 내보낸다(예: `app/api/auth/[...nextauth]/route.ts`). */
export const handlers = {
	GET: (request: Request) => getCmsAuth().handlers.GET(request),
	POST: (request: Request) => getCmsAuth().handlers.POST(request),
};

/** 지금 세션. 없으면 `null`. */
export const auth = () => getCmsAuth().session();
export const signIn = (provider?: string, options?: { redirectTo?: string }) => getCmsAuth().signIn(provider, options);
export const signOut = (options?: { redirectTo?: string }) => getCmsAuth().signOut(options);
export const isAllowedAdminId = (userId: string | null | undefined) => getCmsAuth().isAdmin(userId);
export const isDevAuthBypassEnabled = () => getCmsAuth().devBypass;
/** 로그인 화면에 보일 로그인 방식. */
export const authProviders = () => getCmsAuth().providers;
