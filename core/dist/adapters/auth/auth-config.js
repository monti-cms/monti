import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
/** NextAuth config for logging in with GitHub OAuth. The session carries the GitHub numeric ID (`githubId`). */
export const githubAuthConfig = ({ clientId, clientSecret, basePath, signInPage, secret, }) => ({
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
            }
            else if (user?.githubId != null) {
                token.githubId = user.githubId;
            }
            return token;
        },
        async session({ session, token }) {
            if (token.githubId) {
                session.user.githubId = token.githubId;
                session.user.id = token.githubId;
            }
            return session;
        },
    },
    pages: {
        signIn: signInPage,
    },
    trustHost: true,
});
export const createGithubNextAuth = (credentials) => NextAuth(githubAuthConfig(credentials));
