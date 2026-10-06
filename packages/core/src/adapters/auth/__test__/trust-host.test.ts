import { describe, expect, it } from "vitest";
import { resolveTrustHost } from "../trust-host";

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

	it("is off in production unless configured, so a hosting platform alone does not turn it on", () => {
		expect(resolveTrustHost(undefined, { NODE_ENV: "production" })).toBe(false);
		expect(resolveTrustHost(undefined, { NODE_ENV: "production", VERCEL: "1" })).toBe(false);
		expect(resolveTrustHost(undefined, { NODE_ENV: "production", AUTH_TRUST_HOST: "" })).toBe(false);
	});

	it("is on in development and tests, where the host is localhost", () => {
		expect(resolveTrustHost(undefined, { NODE_ENV: "development" })).toBe(true);
		expect(resolveTrustHost(undefined, { NODE_ENV: "test" })).toBe(true);
	});
});
