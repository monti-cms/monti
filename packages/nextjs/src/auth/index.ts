/**
 * Admin login for a Next.js app. The login itself is `@monti-cms/auth` (no Next.js in it); this entry only supplies what Next.js must:
 * `nextHost` (the headers of the request being handled), to pass as `host` to `auth()`. `githubAuth` is the previous one-call GitHub login,
 * kept so an existing `cms.server.ts` keeps working.
 */
export { type GithubAuthOptions, githubAuth } from "./github-auth";
export { nextHost } from "./host";
