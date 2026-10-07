/**
 * Admin login types and the pieces a login method is built from. The connection itself is built from `auth` in `monti.config.ts`
 * and owned by the CMS instance (`cms.auth()`, `cms.authGateway`). A login method is an `AuthAdapter` (`@monti-cms/core/server`); the one that ships is
 * `auth()` of `@monti-cms/auth` (Auth.js core, with providers such as `github()`), written with the helpers exported here.
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
