/**
 * Admin login for `@monti-cms/core` that works on standard `Request` and `Response`, with no framework: `auth({ providers: [...] })` is used as `auth`
 * in the server config (`cms.server.ts`). A way to log in is a `LoginProvider`; `github()` comes from `@monti-cms/auth/github`.
 * A host framework supplies what it must through `host` (`@monti-cms/nextjs/auth` has the Next.js one).
 */
export { type AuthHost, type AuthOptions, auth } from "./auth";
export {
	type AuthJsProvider,
	type LoginAccount,
	type LoginProvider,
	type LoginProviderContext,
	qualifyAccountId,
	type SignedInAccount,
	type SignedInProviderAccount,
	type SignedInUser,
	splitAccountId,
} from "./provider";
