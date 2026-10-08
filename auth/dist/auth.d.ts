import { type AuthAdapter } from "@monti-cms/core/server";
import { type LoginProvider } from "./provider.js";
/**
 * What the host framework supplies, so this package stays free of any framework. The core cannot know the current request on its own,
 * and a framework may leave a handler by throwing (Next.js redirects that way). `@monti-cms/nextjs/auth` exports the Next.js one.
 */
export interface AuthHost {
    /** Headers of the request being handled, or `null` outside a request. Without it, `session()` needs the request passed in and the development bypass never applies. */
    requestHeaders?(): Promise<Pick<Headers, "get"> | null>;
    /** Throws `error` again when it is a signal the framework uses to leave the handler, so it is not turned into an API error. Does nothing otherwise. */
    rethrow?(error: unknown): void;
}
export interface AuthOptions {
    /** The ways to log in. At least one; ids must be different. */
    readonly providers: readonly LoginProvider[];
    /**
     * Admins by qualified account id (`github:12345678`). The ones listed on a provider (`github({ admins })`) count too; this is for ids
     * you would rather keep in one place. With none anywhere, nobody is an admin.
     */
    readonly admins?: readonly (string | undefined)[];
    /**
     * Treats requests from this machine as admin without login, in local development. On by default under `next dev` (`NODE_ENV=development`), and `false` turns it
     * off there. It never takes effect in production, and only when the environment does not look like a deployed server (hosting platform variables,
     * a public `AUTH_URL`) and the request's host is localhost. Asking for it with `true` on something that looks deployed refuses to start instead.
     */
    readonly devBypass?: boolean;
    /**
     * Login API path. Default `/api/cms/auth`, which the admin API route handles too, so no login route file is needed.
     * The callback URL of an OAuth app is `<site>/<basePath>/callback/<provider id>`.
     */
    readonly basePath?: string;
    /**
     * What the host framework supplies. See {@link AuthHost}. Not needed in a Next.js app: `@monti-cms/nextjs` attaches its host to the instance it serves.
     * Pass one only for code that runs outside such an integration.
     */
    readonly host?: AuthHost;
}
/**
 * Admin login on standard `Request` and `Response`, over Auth.js core (`@auth/core`). The ways to log in are providers (`github()` from
 * `@monti-cms/auth/github`); the session is a signed cookie (a JWT), so nothing is stored for it. Used as `auth` in `defineConfig` (`monti.config.ts`).
 *
 * ```ts
 * auth: auth({ providers: [github()] })
 * ```
 *
 * The session-signing key is derived from the config's one secret (`MONTI_SECRET`), so there is no separate secret to set. Changing the secret signs everyone out;
 * the values stored encrypted keep working through `previousSecrets`.
 */
export declare function auth(options: AuthOptions): AuthAdapter;
