import { AuthError } from "../../adapters/auth/index.js";
import { cmsConfig } from "../../config/resolved.js";
import { HttpError } from "./error-handler.js";
/**
 * Same-origin check for state-changing requests (POST, PATCH, PUT, DELETE).
 * Requires an Origin/Host match or `Sec-Fetch-Site: same-origin`, and rejects when there is no signal at all (fail-closed).
 * Requests with a body must use `Content-Type: application/json` (otherwise 415).
 * Accepted hosts are the proxy-supplied `X-Forwarded-Host`, `Host`, and the host of the site URL (`site.url`). Behind a proxy
 * that rewrites `Host`, the origin sent by the browser still matches.
 */
export function validateSameOrigin(request) {
    const method = request.method.toUpperCase();
    if (["GET", "HEAD", "OPTIONS"].includes(method))
        return;
    const hosts = allowedHosts(request);
    const origin = request.headers.get("origin");
    const secFetchSite = request.headers.get("sec-fetch-site");
    const referer = request.headers.get("referer");
    const sameHost = (value, label) => {
        let url;
        try {
            url = new URL(value);
        }
        catch {
            throw new AuthError("forbidden", `Invalid ${label} header`);
        }
        if (!hosts.has(url.host.toLowerCase()))
            throw new AuthError("forbidden", `Cross-origin ${label} rejected`);
    };
    if (origin) {
        sameHost(origin, "origin");
    }
    else if (secFetchSite) {
        // Only same-origin or none (direct navigation, tools) is allowed.
        if (secFetchSite !== "same-origin" && secFetchSite !== "none") {
            throw new AuthError("forbidden", "Cross-site request rejected");
        }
    }
    else if (referer) {
        sameHost(referer, "referer");
    }
    else {
        throw new AuthError("forbidden", "Missing origin verification headers");
    }
    if (["POST", "PATCH", "PUT"].includes(method)) {
        const contentType = request.headers.get("content-type");
        if (!contentType?.toLowerCase().includes("application/json")) {
            throw new HttpError(415, "unsupported_media_type", "Content-Type must be application/json");
        }
    }
}
/** Host of the site URL (if configured). */
const SITE_HOST = (() => {
    try {
        return cmsConfig.site?.url ? new URL(cmsConfig.site.url).host.toLowerCase() : undefined;
    }
    catch {
        return undefined;
    }
})();
/** Hosts this request is received on. `X-Forwarded-Host` may be comma-separated, so use the first value (received by the outermost proxy). */
function allowedHosts(request) {
    const hosts = new Set();
    const forwarded = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
    for (const host of [forwarded, request.headers.get("host"), request.nextUrl.host, SITE_HOST]) {
        if (host)
            hosts.add(host.toLowerCase());
    }
    return hosts;
}
