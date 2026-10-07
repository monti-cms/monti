import { describe, expect, it } from "vitest";
import { detectProxyPlatform, resolveTrustHost } from "../trust-host";

describe("host trust", () => {
	it("an explicit option wins over the environment", () => {
		expect(resolveTrustHost(true, { NODE_ENV: "production", AUTH_TRUST_HOST: "false" })).toBe(true);
		expect(resolveTrustHost(false, { NODE_ENV: "development", AUTH_TRUST_HOST: "true" })).toBe(false);
	});

	it("AUTH_TRUST_HOST turns it on or off when the option is absent", () => {
		expect(resolveTrustHost(undefined, { NODE_ENV: "production", AUTH_TRUST_HOST: "true" })).toBe(true);
		expect(resolveTrustHost(undefined, { NODE_ENV: "production", AUTH_TRUST_HOST: "1" })).toBe(true);
		expect(resolveTrustHost(undefined, { NODE_ENV: "development", AUTH_TRUST_HOST: "false" })).toBe(false);
		expect(resolveTrustHost(undefined, { NODE_ENV: "development", AUTH_TRUST_HOST: "0" })).toBe(false);
	});

	it("is off in production unless configured or running on a known proxy platform", () => {
		expect(resolveTrustHost(undefined, { NODE_ENV: "production" })).toBe(false);
		expect(resolveTrustHost(undefined, { NODE_ENV: "production", AUTH_TRUST_HOST: "" })).toBe(false);
		expect(
			resolveTrustHost(undefined, {
				NODE_ENV: "production",
				AWS_EXECUTION_ENV: "x",
				KUBERNETES_SERVICE_HOST: "10.0.0.1",
			}),
		).toBe(false);
	});

	it("is on by itself on the known proxy platforms", () => {
		for (const variable of [
			"VERCEL",
			"NETLIFY",
			"CF_PAGES",
			"RENDER",
			"RAILWAY_ENVIRONMENT",
			"FLY_APP_NAME",
			"K_SERVICE",
		]) {
			expect(resolveTrustHost(undefined, { NODE_ENV: "production", [variable]: "1" }), variable).toBe(true);
		}
		expect(detectProxyPlatform({ VERCEL: "1" })).toBe("VERCEL");
		expect(detectProxyPlatform({})).toBeUndefined();
	});

	it("lets an explicit option or AUTH_TRUST_HOST turn it off on a platform", () => {
		expect(resolveTrustHost(false, { NODE_ENV: "production", VERCEL: "1" })).toBe(false);
		expect(resolveTrustHost(undefined, { NODE_ENV: "production", VERCEL: "1", AUTH_TRUST_HOST: "false" })).toBe(false);
	});

	it("is on in development and tests, where the host is localhost", () => {
		expect(resolveTrustHost(undefined, { NODE_ENV: "development" })).toBe(true);
		expect(resolveTrustHost(undefined, { NODE_ENV: "test" })).toBe(true);
	});
});
