import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cmsConfig } from "../../../config/resolved";
import { validateSameOrigin } from "../security";

const post = (url: string, headers: Record<string, string>) =>
	new NextRequest(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: "{}" });

describe("same-origin check", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("accepts only the same origin as Host", () => {
		expect(() =>
			validateSameOrigin(post("http://cms.local/api/cms/v1/x", { origin: "http://cms.local" })),
		).not.toThrow();
		expect(() => validateSameOrigin(post("http://cms.local/api/cms/v1/x", { origin: "https://evil.example" }))).toThrow(
			/Cross-origin/,
		);
	});

	it("behind a trusted proxy that rewrites Host, matches X-Forwarded-Host (first value)", () => {
		const behindProxy = post("http://internal:3000/api/cms/v1/x", {
			host: "internal:3000",
			"x-forwarded-host": "www.example.com, edge.internal",
			origin: "https://www.example.com",
		});
		expect(() => validateSameOrigin(behindProxy, { trustHost: true })).not.toThrow();
	});

	it("ignores a client-supplied X-Forwarded-Host unless the host is trusted", () => {
		const forged = () =>
			post("http://cms.local/api/cms/v1/x", {
				host: "cms.local",
				"x-forwarded-host": "evil.example",
				origin: "https://evil.example",
			});
		expect(() => validateSameOrigin(forged(), { trustHost: false })).toThrow(/Cross-origin/);
		// The same request passes only when a trusted proxy is configured to set that header.
		expect(() => validateSameOrigin(forged(), { trustHost: true })).not.toThrow();
		// A request without it is unaffected either way.
		const direct = post("http://cms.local/api/cms/v1/x", { origin: "http://cms.local" });
		expect(() => validateSameOrigin(direct, { trustHost: false })).not.toThrow();
	});

	it("trusts the forwarded host by the server config and AUTH_TRUST_HOST when no option is passed", () => {
		const behindProxy = () =>
			post("http://internal:3000/api/cms/v1/x", {
				host: "internal:3000",
				"x-forwarded-host": "www.example.com",
				origin: "https://www.example.com",
			});
		vi.stubEnv("AUTH_TRUST_HOST", "false");
		expect(() => validateSameOrigin(behindProxy())).toThrow(/Cross-origin/);
		vi.stubEnv("AUTH_TRUST_HOST", "true");
		expect(() => validateSameOrigin(behindProxy())).not.toThrow();
	});

	it.skipIf(!cmsConfig.site?.url)("also accepts the host of the site URL (site.url)", () => {
		const siteHost = new URL(cmsConfig.site?.url ?? "").host;
		const request = post("http://internal:3000/api/cms/v1/x", { host: "internal:3000", origin: `https://${siteHost}` });
		expect(() => validateSameOrigin(request)).not.toThrow();
	});

	it("rejects when there is no origin signal, and does not check read requests", () => {
		expect(() => validateSameOrigin(post("http://cms.local/api/cms/v1/x", {}))).toThrow(/Missing origin/);
		expect(() => validateSameOrigin(new NextRequest("http://cms.local/api/cms/v1/x"))).not.toThrow();
	});
});
