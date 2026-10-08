/**
 * Admin login for `@monti-cms/core` that works on standard `Request` and `Response`, with no framework: `auth({ providers: [...] })` is used as `auth`
 * in `defineConfig` (`monti.config.ts`). A way to log in is a `LoginProvider`; `github()` comes from `@monti-cms/auth/github`.
 * A host framework supplies what it must through `host` (`@monti-cms/nextjs/auth` has the Next.js one).
 */
export { auth } from "./auth.js";
export { qualifyAccountId, splitAccountId, } from "./provider.js";
