/**
 * Admin login for a Next.js app: GitHub OAuth on NextAuth (`githubAuth`), used as `auth` in the server config (`cms.server.ts`).
 * NextAuth (`next-auth`) is an optional peer dependency: it is loaded the first time login is used.
 */
export { type GithubAuthOptions, githubAuth } from "./github";
