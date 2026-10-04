import type { NextRequest } from "next/server";
/**
 * Same-origin check for state-changing requests (POST, PATCH, PUT, DELETE).
 * Requires an Origin/Host match or `Sec-Fetch-Site: same-origin`, and rejects when there is no signal at all (fail-closed).
 * Requests with a body must use `Content-Type: application/json` (otherwise 415).
 * Accepted hosts are the proxy-supplied `X-Forwarded-Host`, `Host`, and the host of the site URL (`site.url`). Behind a proxy
 * that rewrites `Host`, the origin sent by the browser still matches.
 */
export declare function validateSameOrigin(request: NextRequest): void;
