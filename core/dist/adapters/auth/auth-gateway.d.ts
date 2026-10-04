import type { AuthContext, CmsAuth } from "../../server/define.js";
export type { AuthContext } from "../../server/define.js";
export interface AuthGateway {
    verifyAdmin(): Promise<AuthContext>;
}
export declare class AuthError extends Error {
    readonly code: "unauthorized" | "forbidden";
    constructor(code: "unauthorized" | "forbidden", message: string);
}
/** Whether a GitHub numeric ID is in the admin list. Ignores leading zeros and rejects non-numeric values. */
export declare function isAllowedAdminId(githubId: string | undefined | null, adminIds: readonly (string | undefined)[]): boolean;
/**
 * Whether the auth bypass, local development only, is on. Even if enabled in config, it is true only when `NODE_ENV=development`.
 * Ignored in production even if switched on (fail-closed).
 */
export declare function isDevAuthBypassEnabled(enabled: boolean | undefined): boolean;
/** Authentication for the admin API and UI. The login method is set by `auth` in the server config. */
export declare class CmsAuthGateway implements AuthGateway {
    private readonly getAuth;
    constructor(getAuth: () => CmsAuth);
    verifyAdmin(): Promise<AuthContext>;
}
