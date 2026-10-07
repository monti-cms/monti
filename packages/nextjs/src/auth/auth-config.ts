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
	/** Login API path (NextAuth `basePath`, e.g. `/api/cms/auth`). */
	readonly basePath: string;
	/** Admin login page URL (e.g. `/admin/login`). */
	readonly signInPage: string;
	/** Login session signing value. If unset, NextAuth reads `AUTH_SECRET`. */
	readonly secret?: string;
	/** Whether to build callback URLs from the request host (NextAuth `trustHost`). Default off. `AUTH_URL` fixes the origin, which makes it safe without. */
	readonly trustHost?: boolean;
}

/** NextAuth config for logging in with GitHub OAuth. The session carries the GitHub numeric ID (`githubId`). */
export const githubAuthConfig = ({
	clientId,
	clientSecret,
	basePath,
	signInPage,
	secret,
	trustHost = false,
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
	trustHost: trustHost || Boolean(process.env.AUTH_URL ?? process.env.NEXTAUTH_URL),
});

export const createGithubNextAuth = (credentials: GithubCredentials) => NextAuth(githubAuthConfig(credentials));
