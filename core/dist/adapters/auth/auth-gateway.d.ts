import type { AuthContext, CmsAuth } from "../../server/define.js";
export type { AuthContext } from "../../server/define.js";
export interface AuthGateway {
    verifyAdmin(): Promise<AuthContext>;
    /** Whether the development bypass applies to the current request (on in config, safe environment, request from this machine). */
    isDevBypassActive(): Promise<boolean>;
}
/** Headers of the request being handled, or `null` outside a request. */
export type RequestHeaders = () => Promise<Pick<Headers, "get"> | null>;
export declare class AuthError extends Error {
    readonly code: "unauthorized" | "forbidden";
    constructor(code: "unauthorized" | "forbidden", message: string);
}
/** Whether a GitHub numeric ID is in the admin list. Ignores leading zeros and rejects non-numeric values. */
export declare function isAllowedAdminId(githubId: string | undefined | null, adminIds: readonly (string | undefined)[]): boolean;
/**
 * Whether the auth bypass, local development only, is on. It is on by default under `next dev` (`NODE_ENV=development`) and off in every other mode;
 * `false` turns it off there too. Even when asked for with `true`, it is on only when `NODE_ENV=development` and the environment does not look like a
 * deployed server ({@link productionLikeEnvironment}): fail-closed. Whether a request may use it is decided per request by {@link CmsAuthGateway.isDevBypassActive}.
 */
export declare function isDevAuthBypassEnabled(enabled: boolean | undefined, env?: Readonly<Record<string, string | undefined>>): boolean;
/**
 * Refuses to build the login connection when the bypass is switched on explicitly (`devBypass: true`) in a development-mode process that looks deployed
 * (e.g. a staging server started with `NODE_ENV=development`), where it would open the CMS to everyone. The default (nothing said) is simply off there.
 * In any other mode an explicit `true` is ignored, and says so.
 */
export declare function assertDevBypassSafe(enabled: boolean | undefined, env?: Readonly<Record<string, string | undefined>>): void;
/** Authentication for the admin API and UI. The login method is set by `auth` in `monti.config.ts`. */
export declare class CmsAuthGateway implements AuthGateway {
    private readonly getAuth;
    /** Where the headers of the request being handled come from. Default: the login connection's own (`CmsAuth.requestHeaders`), the host framework's. */
    private readonly requestHeaders;
    constructor(getAuth: () => CmsAuth, 
    /** Where the headers of the request being handled come from. Default: the login connection's own (`CmsAuth.requestHeaders`), the host framework's. */
    requestHeaders?: RequestHeaders);
    isDevBypassActive(): Promise<boolean>;
    verifyAdmin(): Promise<AuthContext>;
}
