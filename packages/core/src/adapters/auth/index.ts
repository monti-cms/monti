/**
 * Admin login types. The connection itself is built from `auth` in the server config (`cms.server.ts`) and owned by the CMS instance
 * (`cms.auth()`, `cms.authGateway`). The side that picks the login method (`githubAuth`) lives in `@monti-cms/core/server`.
 */
export { type AuthContext, AuthError, type AuthGateway, CmsAuthGateway } from "./auth-gateway";
