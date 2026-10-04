import NextAuth, { type DefaultSession, type NextAuthConfig } from "next-auth";
import GitHub from "next-auth/providers/github";

declare module "next-auth" {
	interface Session {
		user: {
			id: string;
			githubId: string;
		} & DefaultSession["user"];
	}

	interface User {
		githubId?: string;
	}
}

export interface GithubCredentials {
	readonly clientId: string | undefined;
	readonly clientSecret: string | undefined;
	/** 로그인 API 경로(NextAuth `basePath`, 예: `/api/cms/auth`). */
	readonly basePath: string;
	/** 관리자 로그인 화면 주소(예: `/admin/login`). */
	readonly signInPage: string;
	/** 로그인 세션 서명 값. 없으면 NextAuth가 `AUTH_SECRET`을 읽는다. */
	readonly secret?: string;
}

/** GitHub OAuth로 로그인하는 NextAuth 설정. 세션에는 GitHub 숫자 ID(`githubId`)를 담는다. */
export const githubAuthConfig = ({
	clientId,
	clientSecret,
	basePath,
	signInPage,
	secret,
}: GithubCredentials): NextAuthConfig => ({
	basePath,
	...(secret ? { secret } : {}),
	providers: [
		GitHub({
			clientId,
			clientSecret,
			profile(profile) {
				const numericId = String(profile.id);
				return {
					id: numericId,
					githubId: numericId,
					name: profile.name ?? profile.login,
					email: profile.email,
					image: profile.avatar_url,
				};
			},
		}),
	],
	session: {
		strategy: "jwt",
		maxAge: 28_800, // 8 hours (rolling)
	},
	callbacks: {
		async jwt({ token, user, profile }) {
			if (profile?.id != null) {
				token.githubId = String(profile.id);
			} else if (user?.githubId != null) {
				token.githubId = user.githubId;
			}
			return token;
		},
		async session({ session, token }) {
			if (token.githubId) {
				session.user.githubId = token.githubId as string;
				session.user.id = token.githubId as string;
			}
			return session;
		},
	},
	pages: {
		signIn: signInPage,
	},
	trustHost: true,
});

export const createGithubNextAuth = (credentials: GithubCredentials) => NextAuth(githubAuthConfig(credentials));
