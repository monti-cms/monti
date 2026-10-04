import { withBasePath } from "../../core/base-path";
import { createActiveTranslator } from "../../i18n/active";
import { type AuthAdapter, CMS_AUTH_BASE_PATH, type CmsAuth } from "../../server/define";
import type { createGithubNextAuth } from "./auth-config";
import { isAllowedAdminId, isDevAuthBypassEnabled } from "./auth-gateway";
import { authMessages } from "./messages";

/** 화면 언어는 글자를 읽을 때 고른다. 사이트 설정을 읽는 `i18n` 대신 써서 `cms.server.ts`가 설정을 끌어오지 않게 한다(M17-3). */
const t = createActiveTranslator(authMessages);

export interface GithubAuthOptions {
	readonly clientId: string | undefined;
	readonly clientSecret: string | undefined;
	/** 관리자 GitHub 숫자 ID. 비어 있으면 아무도 관리자가 아니다. */
	readonly adminIds: readonly (string | undefined)[];
	/** 로컬 개발에서 로그인 없이 관리자로 본다. `NODE_ENV=development`일 때만 효과가 있다. */
	readonly devBypass?: boolean;
	/**
	 * 로그인 API 경로. 기본 `/api/cms/auth`로, 관리자 API 라우트가 함께 받아 로그인 라우트 파일이 필요 없다.
	 * GitHub OAuth 앱의 콜백 주소는 `<사이트>/<basePath>/callback/github`다. 예전처럼 `/api/auth`를 쓰려면
	 * `basePath: "/api/auth"`로 두고 `app/api/auth/[...nextauth]/route.ts`에서 `@monti-cms/core/runtime`의 `handlers`를 내보낸다.
	 */
	readonly basePath?: string;
	/**
	 * 로그인 세션 서명 값(NextAuth `secret`). 저장 값 암호화 키(서버 설정 `secret`)와 따로 둔다: 이 값을 바꾸면 로그인만 풀리고,
	 * 암호화 키를 바꾸면 저장한 AI 서비스 키를 다시 넣어야 한다. 없으면 NextAuth가 `AUTH_SECRET` 환경 변수를 읽는다.
	 */
	readonly secret?: string;
}

type NextAuthResult = ReturnType<typeof createGithubNextAuth>;

/**
 * GitHub OAuth(NextAuth) 관리자 로그인. NextAuth는 로그인 기능을 처음 쓸 때 불러온다
 * (저장소만 쓰는 코드·명령줄 도구가 next-auth를 읽지 않게).
 */
export function githubAuth(options: GithubAuthOptions): AuthAdapter {
	return {
		name: "github",
		create: ({ loginPath }): CmsAuth => {
			const basePath = (options.basePath ?? CMS_AUTH_BASE_PATH).replace(/\/$/, "");
			let nextAuth: Promise<NextAuthResult> | undefined;
			const load = () => {
				nextAuth ??= import("./auth-config").then((module) =>
					module.createGithubNextAuth({
						...options,
						// NextAuth는 브라우저가 보는 요청 주소로 경로를 가리므로 Next `basePath`까지 포함한다(`CmsAuth.basePath`는 앱 안 경로).
						basePath: withBasePath(basePath),
						signInPage: loginPath,
					}),
				);
				return nextAuth;
			};
			return {
				basePath,
				handlers: {
					GET: async (request) =>
						(await load()).handlers.GET(request as Parameters<NextAuthResult["handlers"]["GET"]>[0]),
					POST: async (request) =>
						(await load()).handlers.POST(request as Parameters<NextAuthResult["handlers"]["POST"]>[0]),
				},
				session: async () => {
					const session = await (await load()).auth();
					if (!session) return null;
					return { user: { id: session.user?.id, accountId: session.user?.githubId } };
				},
				providers: [
					{
						id: "github",
						name: "GitHub",
						get label() {
							return t("github.label");
						},
					},
				],
				signIn: async (provider = "github", signInOptions) => (await load()).signIn(provider, signInOptions),
				signOut: async (signOutOptions) => (await load()).signOut(signOutOptions),
				isAdmin: (userId) => isAllowedAdminId(userId, options.adminIds),
				get devBypass() {
					return isDevAuthBypassEnabled(options.devBypass);
				},
				devUserId: options.adminIds.find((id) => id?.trim())?.trim() || "local-dev",
			};
		},
	};
}
