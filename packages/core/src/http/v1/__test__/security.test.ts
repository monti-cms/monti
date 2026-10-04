import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { cmsConfig } from "../../../config/resolved";
import { validateSameOrigin } from "../security";

const post = (url: string, headers: Record<string, string>) =>
	new NextRequest(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: "{}" });

describe("same-origin check", () => {
	it("accepts only the same origin as Host", () => {
		expect(() =>
			validateSameOrigin(post("http://cms.local/api/cms/v1/x", { origin: "http://cms.local" })),
		).not.toThrow();
		expect(() => validateSameOrigin(post("http://cms.local/api/cms/v1/x", { origin: "https://evil.example" }))).toThrow(
			/Cross-origin/,
		);
	});

	it("behind a proxy that rewrites Host, matches X-Forwarded-Host (first value)", () => {
		const behindProxy = post("http://internal:3000/api/cms/v1/x", {
			host: "internal:3000",
			"x-forwarded-host": "www.example.com, edge.internal",
			origin: "https://www.example.com",
		});
		expect(() => validateSameOrigin(behindProxy)).not.toThrow();
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
