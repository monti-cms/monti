import { type DefaultSession, type NextAuthConfig } from "next-auth";
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
}
/** NextAuth config for logging in with GitHub OAuth. The session carries the GitHub numeric ID (`githubId`). */
export declare const githubAuthConfig: ({ clientId, clientSecret, basePath, signInPage, secret, }: GithubCredentials) => NextAuthConfig;
export declare const createGithubNextAuth: (credentials: GithubCredentials) => import("next-auth").NextAuthResult;
