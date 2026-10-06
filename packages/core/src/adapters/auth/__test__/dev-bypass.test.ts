import { describe, expect, it } from "vitest";
import { isLoopbackHostname, isLoopbackRequest, productionLikeEnvironment } from "../dev-bypass";

const request = (headers: Record<string, string>) => new Headers(headers);

describe("loopback host names", () => {
	it("accepts this machine in its usual spellings", () => {
		for (const name of [
			"localhost",
			"LOCALHOST",
			"app.localhost",
			"127.0.0.1",
			"127.1.2.3",
			"::1",
			"[::1]",
			"::ffff:127.0.0.1",
		]) {
			expect(isLoopbackHostname(name), name).toBe(true);
		}
	});

	it("rejects every other name, including ones that merely contain localhost", () => {
		for (const name of [
			"example.com",
			"localhost.example.com",
			"10.0.0.5",
			"192.168.1.2",
			"128.0.0.1",
			"",
			"0.0.0.0",
		]) {
			expect(isLoopbackHostname(name), name).toBe(false);
		}
	});
});

describe("loopback request", () => {
	it("accepts a request that reaches the dev server directly", () => {
		expect(isLoopbackRequest(request({ host: "localhost:3000" }))).toBe(true);
		expect(isLoopbackRequest(request({ host: "127.0.0.1:3000", "x-forwarded-for": "127.0.0.1" }))).toBe(true);
		expect(isLoopbackRequest(request({ host: "[::1]:3000", "x-forwarded-for": "::1" }))).toBe(true);
		expect(isLoopbackRequest(request({ host: "localhost:3000", "x-forwarded-host": "localhost:3000" }))).toBe(true);
	});

	it("rejects a request addressed to another host", () => {
		expect(isLoopbackRequest(request({ host: "staging.example.com" }))).toBe(false);
		expect(isLoopbackRequest(request({ host: "203.0.113.7:3000" }))).toBe(false);
		expect(isLoopbackRequest(request({}))).toBe(false);
	});

	it("rejects a request a proxy forwarded from somewhere else", () => {
		expect(isLoopbackRequest(request({ host: "localhost:3000", "x-forwarded-host": "staging.example.com" }))).toBe(
			false,
		);
		expect(isLoopbackRequest(request({ host: "localhost:3000", "x-forwarded-for": "203.0.113.9" }))).toBe(false);
		expect(isLoopbackRequest(request({ host: "localhost:3000", "x-forwarded-for": "127.0.0.1, 203.0.113.9" }))).toBe(
			false,
		);
	});
});

describe("production-looking environment", () => {
	it("is not detected on a developer machine", () => {
		expect(productionLikeEnvironment({ NODE_ENV: "development" })).toBeUndefined();
		expect(productionLikeEnvironment({ AUTH_URL: "http://localhost:3000" })).toBeUndefined();
		expect(productionLikeEnvironment({ AUTH_URL: "not a url" })).toBe(
			"AUTH_URL points to a public address (not a url)",
		);
	});

	it("is detected from hosting platform variables, with the reason", () => {
		expect(productionLikeEnvironment({ VERCEL: "1" })).toMatch(/VERCEL/);
		expect(productionLikeEnvironment({ FLY_APP_NAME: "monti" })).toMatch(/FLY_APP_NAME/);
	});

	it("is detected from a public AUTH_URL or NEXTAUTH_URL", () => {
		expect(productionLikeEnvironment({ AUTH_URL: "https://cms.example.com" })).toMatch(/AUTH_URL/);
		expect(productionLikeEnvironment({ NEXTAUTH_URL: "https://cms.example.com" })).toMatch(/cms\.example\.com/);
	});
});
