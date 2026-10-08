import { describe, expect, it } from "vitest";
import { type AuthOptions, auth } from "../auth";
import { github } from "../github";

const decide = (options: Partial<AuthOptions>, env: Record<string, string | undefined>) =>
	Object.fromEntries(
		(auth({ providers: [github()], ...options }).decisions?.(env) ?? []).map((item) => [item.topic, item]),
	);

describe("github().provenance", () => {
	const provenance = (options: Parameters<typeof github>[0], env: Record<string, string | undefined>) =>
		github(options).provenance?.(env) ?? "";

	it("reads the client id, secret and admins from the environment", () => {
		expect(provenance({}, { AUTH_GITHUB_ID: "i", AUTH_GITHUB_SECRET: "s", MONTI_ADMIN_GITHUB_ID: "1" })).toBe(
			"client id from env AUTH_GITHUB_ID, client secret from env AUTH_GITHUB_SECRET, admins from env MONTI_ADMIN_GITHUB_ID",
		);
	});

	it("says what is set in the config", () => {
		expect(provenance({ clientId: "i", clientSecret: "s", admins: ["1"] }, {})).toBe(
			"client id set in monti.config.ts, client secret set in monti.config.ts, admins set in monti.config.ts",
		);
	});

	it("says what is missing", () => {
		const text = provenance({}, {});
		expect(text).toContain("client id: env AUTH_GITHUB_ID is not set");
		expect(text).toContain("client secret: env AUTH_GITHUB_SECRET is not set");
		expect(text).toContain("no admin: env MONTI_ADMIN_GITHUB_ID is not set");
	});

	it("never prints a value", () => {
		const text = provenance(
			{},
			{ AUTH_GITHUB_ID: "id-value", AUTH_GITHUB_SECRET: "secret-value", MONTI_ADMIN_GITHUB_ID: "99887766" },
		);
		expect(text).not.toMatch(/id-value|secret-value|99887766/);
	});
});

describe("auth().decisions", () => {
	it("lists the login providers with where their settings come from", () => {
		const { Login } = decide({}, { NODE_ENV: "production", AUTH_GITHUB_ID: "i" });
		expect(Login?.value).toBe("GitHub");
		expect(Login?.source).toContain("client id from env AUTH_GITHUB_ID");
	});

	it("falls back to a generic source for a provider without provenance", () => {
		const provider = { ...github(), provenance: undefined };
		expect(decide({ providers: [provider] }, {}).Login?.source).toBe("set in monti.config.ts (github)");
	});

	it("turns the dev bypass on in development on a developer's machine", () => {
		const bypass = decide({}, { NODE_ENV: "development" })["Dev login bypass"];
		expect(bypass?.value).toMatch(/^on/);
		expect(bypass?.source).toContain("auto-detected");
	});

	it("reports an explicit devBypass: true", () => {
		expect(decide({ devBypass: true }, { NODE_ENV: "development" })["Dev login bypass"]).toMatchObject({
			value: expect.stringMatching(/^on/),
			source: "set in monti.config.ts (devBypass: true)",
		});
	});

	it("reports an explicit devBypass: false", () => {
		expect(decide({ devBypass: false }, { NODE_ENV: "development" })["Dev login bypass"]).toEqual({
			topic: "Dev login bypass",
			value: "off",
			source: "set in monti.config.ts (devBypass: false)",
		});
	});

	it("is off outside development, and says the NODE_ENV", () => {
		const bypass = decide({}, { NODE_ENV: "production" })["Dev login bypass"];
		expect(bypass?.value).toBe("off");
		expect(bypass?.source).toContain('NODE_ENV is "production"');
		expect(decide({ devBypass: true }, { NODE_ENV: "production" })["Dev login bypass"]?.value).toBe("off");
	});

	it("is off when development mode looks deployed, and says why", () => {
		const bypass = decide({}, { NODE_ENV: "development", VERCEL: "1" })["Dev login bypass"];
		expect(bypass?.value).toBe("off");
		expect(bypass?.source).toContain("looks deployed");
		expect(bypass?.source).toContain("VERCEL");
	});
});
