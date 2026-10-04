import { type AuthAdapter } from "../../server/define.js";
export interface GithubAuthOptions {
    readonly clientId: string | undefined;
    readonly clientSecret: string | undefined;
    /** Admin GitHub numeric IDs. If empty, nobody is an admin. */
    readonly adminIds: readonly (string | undefined)[];
    /** Treats the user as admin without login in local development. Only takes effect when `NODE_ENV=development`. */
    readonly devBypass?: boolean;
    /**
     * Login API path. Default `/api/cms/auth`, which the admin API route handles too, so no login route file is needed.
     * The callback URL of the GitHub OAuth app is `<site>/<basePath>/callback/github`. To keep using `/api/auth` as before,
     * set `basePath: "/api/auth"` and export `handlers` from `@monti-cms/core/runtime` in `app/api/auth/[...nextauth]/route.ts`.
     */
    readonly basePath?: string;
    /**
     * Login session signing value (NextAuth `secret`). Kept separate from the stored-value encryption key (server config `secret`): changing this only signs users out,
     * while changing the encryption key means re-entering the stored AI service keys. If unset, NextAuth reads the `AUTH_SECRET` environment variable.
     */
    readonly secret?: string;
}
/**
 * GitHub OAuth (NextAuth) admin login. NextAuth is loaded the first time login is used
 * (so code that only uses the store, and command-line tools, do not read next-auth).
 */
export declare function githubAuth(options: GithubAuthOptions): AuthAdapter;
