import { afterEach, describe, expect, it, vi } from "vitest";
import { testConfig } from "../../../../test/site";
import { fakeCms } from "../../../cms/fake-cms";
import { ERROR_STATUS } from "../error-handler";
import { validateSameOrigin } from "../security";

/** An instance whose `trustHost` is set (or left to `AUTH_TRUST_HOST` and the environment when `undefined`). */
const cmsWith = (trustHost?: boolean) => fakeCms({ config: testConfig, server: { trustHost } });
const cms = cmsWith();

const post = (url: string, headers: Record<string, string>) =>
	new Request(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: "{}" });

describe("same-origin check", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("API-G2 accepts only the same origin as Host", () => {
		expect(() =>
			validateSameOrigin(cms, post("http://cms.local/api/monti/v1/x", { origin: "http://cms.local" })),
		).not.toThrow();
		expect(() =>
			validateSameOrigin(cms, post("http://cms.local/api/monti/v1/x", { origin: "https://evil.example" })),
		).toThrow(/Cross-origin/);
	});

	it("API-G2 behind a trusted proxy that rewrites Host, matches X-Forwarded-Host (first value)", () => {
		const behindProxy = post("http://internal:3000/api/monti/v1/x", {
			host: "internal:3000",
			"x-forwarded-host": "www.example.com, edge.internal",
			origin: "https://www.example.com",
		});
		expect(() => validateSameOrigin(cmsWith(true), behindProxy)).not.toThrow();
	});

	it("API-G2 ignores a client-supplied X-Forwarded-Host unless the host is trusted", () => {
		const forged = () =>
			post("http://cms.local/api/monti/v1/x", {
				host: "cms.local",
				"x-forwarded-host": "evil.example",
				origin: "https://evil.example",
			});
		expect(() => validateSameOrigin(cmsWith(false), forged())).toThrow(/Cross-origin/);
		// The same request passes only when a trusted proxy is configured to set that header.
		expect(() => validateSameOrigin(cmsWith(true), forged())).not.toThrow();
		// A request without it is unaffected either way.
		const direct = post("http://cms.local/api/monti/v1/x", { origin: "http://cms.local" });
		expect(() => validateSameOrigin(cmsWith(false), direct)).not.toThrow();
	});

	it("trusts the forwarded host by the server config and AUTH_TRUST_HOST when no option is passed", () => {
		const behindProxy = () =>
			post("http://internal:3000/api/monti/v1/x", {
				host: "internal:3000",
				"x-forwarded-host": "www.example.com",
				origin: "https://www.example.com",
			});
		vi.stubEnv("AUTH_TRUST_HOST", "false");
		expect(() => validateSameOrigin(cms, behindProxy())).toThrow(/Cross-origin/);
		vi.stubEnv("AUTH_TRUST_HOST", "true");
		expect(() => validateSameOrigin(cms, behindProxy())).not.toThrow();
	});

	it.skipIf(!testConfig.site?.url)("API-G2 also accepts the host of the site URL (site.url)", () => {
		const siteHost = new URL(testConfig.site?.url ?? "").host;
		const request = post("http://internal:3000/api/monti/v1/x", {
			host: "internal:3000",
			origin: `https://${siteHost}`,
		});
		expect(() => validateSameOrigin(cms, request)).not.toThrow();
	});

	it("API-G2 without an Origin, takes Sec-Fetch-Site: same-origin and none, and rejects a cross-site or same-site request", () => {
		const fetchedFrom = (site: string) => post("http://cms.local/api/monti/v1/x", { "sec-fetch-site": site });
		expect(() => validateSameOrigin(cms, fetchedFrom("same-origin"))).not.toThrow();
		expect(() => validateSameOrigin(cms, fetchedFrom("none"))).not.toThrow();
		expect(() => validateSameOrigin(cms, fetchedFrom("cross-site"))).toThrow(
			expect.objectContaining({ code: "forbidden" }),
		);
		expect(() => validateSameOrigin(cms, fetchedFrom("same-site"))).toThrow(
			expect.objectContaining({ code: "forbidden" }),
		);
	});

	it("API-G2 with only a Referer, takes it from the same host and rejects one from another host", () => {
		const referredBy = (url: string) => post("http://cms.local/api/monti/v1/x", { referer: url });
		expect(() => validateSameOrigin(cms, referredBy("http://cms.local/admin/posts"))).not.toThrow();
		expect(() => validateSameOrigin(cms, referredBy("https://evil.example/page"))).toThrow(
			expect.objectContaining({ code: "forbidden" }),
		);
	});

	it("API-G2 refuses text/plain on a JSON route with 415, also from the same origin", () => {
		const plain = new Request("http://cms.local/api/monti/v1/x", {
			method: "POST",
			headers: { origin: "http://cms.local", "content-type": "text/plain" },
			body: "{}",
		});
		expect(() => validateSameOrigin(cms, plain)).toThrow(expect.objectContaining({ code: "unsupported_media_type" }));
		expect(ERROR_STATUS.unsupported_media_type).toBe(415);
	});

	it("API-G2 rejects when there is no origin signal, and does not check read requests", () => {
		expect(() => validateSameOrigin(cms, post("http://cms.local/api/monti/v1/x", {}))).toThrow(/Missing origin/);
		expect(() => validateSameOrigin(cms, new Request("http://cms.local/api/monti/v1/x"))).not.toThrow();
	});
});
