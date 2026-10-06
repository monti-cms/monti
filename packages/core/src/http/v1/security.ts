import type { NextRequest } from "next/server";
import { AuthError } from "../../adapters/auth";
import { resolveTrustHost } from "../../adapters/auth/trust-host";
import { cmsConfig } from "../../config/resolved";
import { HttpError } from "./error-handler";

/**
 * Same-origin check for state-changing requests (POST, PATCH, PUT, DELETE).
 * Requires an Origin/Host match or `Sec-Fetch-Site: same-origin`, and rejects when there is no signal at all (fail-closed).
 * Requests with a body must use `Content-Type: application/json` (otherwise 415).
 * Accepted hosts are `Host`, the host the request URL names, and the host of the site URL (`site.url`). `X-Forwarded-Host` is accepted only when
 * the host is trusted (`trustHost` in the server config or `AUTH_TRUST_HOST`, i.e. the server runs behind a proxy that sets it), because a client can send
 * that header itself. Behind a proxy that rewrites `Host` without that option, set `site.url` so the public host is still accepted.
 */
export function validateSameOrigin(
	request: NextRequest,
	options: {
		/** Whether `X-Forwarded-Host` can be trusted (`cms.isHostTrusted()`). Default: the `AUTH_TRUST_HOST` environment variable, else off in production. */
		readonly trustHost?: boolean;
		/** Also accept a browser form post (`application/x-www-form-urlencoded`), for the sign-in and sign-out forms. */
		readonly form?: boolean;
	} = {},
): void {
	const method = request.method.toUpperCase();
	if (["GET", "HEAD", "OPTIONS"].includes(method)) return;

	const hosts = allowedHosts(request, options.trustHost ?? resolveTrustHost(undefined));
	const origin = request.headers.get("origin");
	const secFetchSite = request.headers.get("sec-fetch-site");
	const referer = request.headers.get("referer");

	const sameHost = (value: string, label: string) => {
		let url: URL;
		try {
			url = new URL(value);
		} catch {
			throw new AuthError("forbidden", `Invalid ${label} header`);
		}
		if (!hosts.has(url.host.toLowerCase())) throw new AuthError("forbidden", `Cross-origin ${label} rejected`);
	};

	if (origin) {
		sameHost(origin, "origin");
	} else if (secFetchSite) {
		// Only same-origin or none (direct navigation, tools) is allowed.
		if (secFetchSite !== "same-origin" && secFetchSite !== "none") {
			throw new AuthError("forbidden", "Cross-site request rejected");
		}
	} else if (referer) {
		sameHost(referer, "referer");
	} else {
		throw new AuthError("forbidden", "Missing origin verification headers");
	}

	if (["POST", "PATCH", "PUT"].includes(method)) {
		const contentType = request.headers.get("content-type");
		const accepted = options.form ? ["application/json", "application/x-www-form-urlencoded"] : ["application/json"];
		if (!accepted.some((type) => contentType?.toLowerCase().includes(type))) {
			throw new HttpError(415, "unsupported_media_type", `Content-Type must be ${accepted.join(" or ")}`);
		}
	}
}

/** Host of the site URL (if configured). */
const SITE_HOST = (() => {
	try {
		return cmsConfig.site?.url ? new URL(cmsConfig.site.url).host.toLowerCase() : undefined;
	} catch {
		return undefined;
	}
})();

/** Hosts this request is received on. `X-Forwarded-Host` may be comma-separated, so use the first value (received by the outermost proxy). Used only when the host is trusted. */
function allowedHosts(request: NextRequest, trustHost: boolean): Set<string> {
	const hosts = new Set<string>();
	const forwarded = trustHost ? request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() : undefined;
	for (const host of [forwarded, request.headers.get("host"), request.nextUrl.host, SITE_HOST]) {
		if (host) hosts.add(host.toLowerCase());
	}
	return hosts;
}
