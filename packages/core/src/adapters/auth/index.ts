/**
 * Admin login types and the pieces a login method is built from. The connection itself is built from `auth` in the server config (`cms.server.ts`)
 * and owned by the CMS instance (`cms.auth()`, `cms.authGateway`). A login method is an `AuthAdapter` (`@monti-cms/core/server`); the GitHub one
 * (`githubAuth`) lives in `@monti-cms/nextjs/auth`, because it is NextAuth, and is written with the helpers exported here.
 */
export { withBasePath } from "../../core/base-path";
export {
	type AuthContext,
	AuthError,
	type AuthGateway,
	assertDevBypassSafe,
	CmsAuthGateway,
	isAllowedAdminId,
	isDevAuthBypassEnabled,
} from "./auth-gateway";
