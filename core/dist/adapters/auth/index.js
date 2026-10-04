import { getCmsAuth } from "../../container.js";
import { CmsAuthGateway } from "./auth-gateway.js";
/**
 * Admin login runtime API. Uses the connection built from `auth` in the server config (`cms.server.ts`).
 * The side that picks the login method (`githubAuth`) lives in `@monti-cms/core/server`.
 */
export { AuthError } from "./auth-gateway.js";
export const authGateway = new CmsAuthGateway(getCmsAuth);
/** Login API route handlers. An app whose login path differs from the default (`/api/cms/auth`) exports it from the route file at that path (e.g. `app/api/auth/[...nextauth]/route.ts`). */
export const handlers = {
    GET: (request) => getCmsAuth().handlers.GET(request),
    POST: (request) => getCmsAuth().handlers.POST(request),
};
/** Current session. `null` if none. */
export const auth = () => getCmsAuth().session();
export const signIn = (provider, options) => getCmsAuth().signIn(provider, options);
export const signOut = (options) => getCmsAuth().signOut(options);
export const isAllowedAdminId = (userId) => getCmsAuth().isAdmin(userId);
export const isDevAuthBypassEnabled = () => getCmsAuth().devBypass;
/** Login methods to show on the login page. */
export const authProviders = () => getCmsAuth().providers;
