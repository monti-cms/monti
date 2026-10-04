import type { NextRequest } from "next/server";
import { AuthError } from "../../adapters/auth";
import { cmsConfig } from "../../config/resolved";
import { HttpError } from "./error-handler";

/**
 * 상태를 바꾸는 요청(POST·PATCH·PUT·DELETE)의 동일 출처 검사(§10.2 CSRF 방어).
 * Origin/Host 일치 또는 `Sec-Fetch-Site: same-origin`을 요구하고, 신호가 하나도 없으면 거부한다(fail-closed).
 * 본문을 받는 요청은 `Content-Type: application/json`이어야 한다(아니면 415).
 * 받는 호스트는 프록시가 넘긴 `X-Forwarded-Host`, `Host`, 그리고 사이트 주소(`site.url`)의 호스트다. `Host`를 바꾸는 프록시
 * 뒤에서도 브라우저가 보낸 출처와 맞는다.
 */
export function validateSameOrigin(request: NextRequest): void {
	const method = request.method.toUpperCase();
	if (["GET", "HEAD", "OPTIONS"].includes(method)) return;

	const hosts = allowedHosts(request);
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
		// same-origin 또는 none(직접 탐색·도구)만 허용한다.
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
		if (!contentType?.toLowerCase().includes("application/json")) {
			throw new HttpError(415, "unsupported_media_type", "Content-Type must be application/json");
		}
	}
}

/** 사이트 주소의 호스트(설정에 있으면). */
const SITE_HOST = (() => {
	try {
		return cmsConfig.site?.url ? new URL(cmsConfig.site.url).host.toLowerCase() : undefined;
	} catch {
		return undefined;
	}
})();

/** 이 요청이 받는 호스트들. `X-Forwarded-Host`는 쉼표로 여럿일 수 있어 첫 값(맨 앞 프록시가 받은 값)을 쓴다. */
function allowedHosts(request: NextRequest): Set<string> {
	const hosts = new Set<string>();
	const forwarded = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
	for (const host of [forwarded, request.headers.get("host"), request.nextUrl.host, SITE_HOST]) {
		if (host) hosts.add(host.toLowerCase());
	}
	return hosts;
}
