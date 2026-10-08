import type { LoginProvider } from "./provider.js";
/** The environment variables `github()` reads when an option is not given. Nothing else is looked at. */
export declare const GITHUB_ENV: {
    readonly clientId: "AUTH_GITHUB_ID";
    readonly clientSecret: "AUTH_GITHUB_SECRET";
    readonly admin: "MONTI_ADMIN_GITHUB_ID";
};
export interface GithubOptions {
    /** Client id of the GitHub OAuth app. If unset, the `AUTH_GITHUB_ID` environment variable. */
    readonly clientId?: string | undefined;
    /** Client secret of the GitHub OAuth app. If unset, the `AUTH_GITHUB_SECRET` environment variable. */
    readonly clientSecret?: string | undefined;
    /**
     * Admins by numeric GitHub id (`"12345678"`, or `"github:12345678"`). Logins are not accepted: a login can be renamed and then taken by someone else.
     * If unset, the `MONTI_ADMIN_GITHUB_ID` environment variable (one id, or several separated by commas). Unset entries are skipped. With none, nobody is an admin.
     */
    readonly admins?: readonly (string | undefined)[];
}
/**
 * Log in with GitHub. It works with no arguments: the OAuth app comes from `AUTH_GITHUB_ID` and `AUTH_GITHUB_SECRET`, the admin from `MONTI_ADMIN_GITHUB_ID`,
 * and a value passed here wins. A missing id or secret is an error that names the variable. The account id is the numeric GitHub id, so `github:12345678`
 * is the same person after a rename. The callback URL of the OAuth app is `<site>/api/cms/auth/callback/github`.
 */
export declare function github(options?: GithubOptions): LoginProvider;
