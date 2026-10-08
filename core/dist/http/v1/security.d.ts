import type { Cms } from "../../cms/index.js";
/**
 * Same-origin check for state-changing requests (POST, PATCH, PUT, DELETE).
 * Requires an Origin/Host match or `Sec-Fetch-Site: same-origin`, and rejects when there is no signal at all (fail-closed).
 * Requests with a body must use `Content-Type: application/json` (otherwise 415).
 * Accepted hosts are `Host`, the host the request URL names, and the host of the site URL (`site.url`). `X-Forwarded-Host` is accepted only when
 * the host is trusted (`trustHost` in the server config or `AUTH_TRUST_HOST`, i.e. the server runs behind a proxy that sets it), because a client can send
 * that header itself. Behind a proxy that rewrites `Host` without that option, set `site.url` so the public host is still accepted.
 */
export declare function validateSameOrigin(
/** The instance serving the request: whether `X-Forwarded-Host` can be trusted (`cms.isHostTrusted()`), and the site URL (`site.url`) of its config. */
cms: Pick<Cms, "isHostTrusted" | "site">, request: Request, options?: {
    /** Also accept a browser form post (`application/x-www-form-urlencoded`), for the sign-in and sign-out forms. */
    readonly form?: boolean;
}): void;
