import { type AuthGateway } from "./auth-gateway.js";
/**
 * Admin login runtime API. Uses the connection built from `auth` in the server config (`cms.server.ts`).
 * The side that picks the login method (`githubAuth`) lives in `@monti-cms/core/server`.
 */
export { type AuthContext, AuthError, type AuthGateway } from "./auth-gateway.js";
export declare const authGateway: AuthGateway;
/** Login API route handlers. An app whose login path differs from the default (`/api/cms/auth`) exports it from the route file at that path (e.g. `app/api/auth/[...nextauth]/route.ts`). */
export declare const handlers: {
    GET: (request: Request) => Promise<Response>;
    POST: (request: Request) => Promise<Response>;
};
/** Current session. `null` if none. */
export declare const auth: () => Promise<{
    user?: {
        id?: string;
        accountId?: string;
    };
} | null>;
export declare const signIn: (provider?: string, options?: {
    redirectTo?: string;
}) => Promise<unknown>;
export declare const signOut: (options?: {
    redirectTo?: string;
}) => Promise<unknown>;
export declare const isAllowedAdminId: (userId: string | null | undefined) => boolean;
export declare const isDevAuthBypassEnabled: () => boolean;
/** Login methods to show on the login page. */
export declare const authProviders: () => readonly import("../../server/index.js").AuthProvider[];
