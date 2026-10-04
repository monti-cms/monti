import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { cmsConfig } from "../../../config/resolved";
import { validateSameOrigin } from "../security";

const post = (url: string, headers: Record<string, string>) =>
	new NextRequest(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: "{}" });

describe("같은 출처 검사(§10.2, M13-2)", () => {
	it("Host와 같은 출처만 받는다", () => {
		expect(() =>
			validateSameOrigin(post("http://cms.local/api/cms/v1/x", { origin: "http://cms.local" })),
		).not.toThrow();
		expect(() => validateSameOrigin(post("http://cms.local/api/cms/v1/x", { origin: "https://evil.example" }))).toThrow(
			/Cross-origin/,
		);
	});

	it("Host를 바꾸는 프록시 뒤에서는 X-Forwarded-Host(첫 값)와 맞춘다", () => {
		const behindProxy = post("http://internal:3000/api/cms/v1/x", {
			host: "internal:3000",
			"x-forwarded-host": "www.example.com, edge.internal",
			origin: "https://www.example.com",
		});
		expect(() => validateSameOrigin(behindProxy)).not.toThrow();
	});

	it.skipIf(!cmsConfig.site?.url)("사이트 주소(site.url)의 호스트도 받는다", () => {
		const siteHost = new URL(cmsConfig.site?.url ?? "").host;
		const request = post("http://internal:3000/api/cms/v1/x", { host: "internal:3000", origin: `https://${siteHost}` });
		expect(() => validateSameOrigin(request)).not.toThrow();
	});

	it("출처 신호가 없으면 거부하고, 읽기 요청은 검사하지 않는다", () => {
		expect(() => validateSameOrigin(post("http://cms.local/api/cms/v1/x", {}))).toThrow(/Missing origin/);
		expect(() => validateSameOrigin(new NextRequest("http://cms.local/api/cms/v1/x"))).not.toThrow();
	});
});
