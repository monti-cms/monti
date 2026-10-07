import { auth } from "@monti-cms/auth";
import { github } from "@monti-cms/auth/github";
import { createSite } from "@monti-cms/core/client";
import { CMS_AUTH_BASE_PATH } from "@monti-cms/core/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { testConfig } from "../../../../core/test/site";
import { githubAuth, nextHost } from "../index";

const ADMIN_ID = "12345678";
const context = {
	site: createSite(testConfig),
	loginPath: "/studio/login",
	trustHost: false,
	storage: () => {
		throw new Error("not used");
	},
};

afterEach(() => {
	vi.unstubAllEnvs();
	vi.restoreAllMocks();
});

describe("Next.js side of the login", () => {
	it("has no request headers outside a request (a command-line tool, a build)", async () => {
		expect(await nextHost.requestHeaders?.()).toBeNull();
	});

	it("passes the host's request headers to the login connection, and needs no rethrow", () => {
		const connection = auth({ providers: [github({ admins: [ADMIN_ID] })], host: nextHost }).create(context);
		expect(connection.requestHeaders).toBe(nextHost.requestHeaders);
		expect(connection.rethrow).toBeUndefined();
	});
});

describe("githubAuth (the previous one-call GitHub login)", () => {
	const options = { clientId: "id", clientSecret: "secret", adminIds: [undefined, ADMIN_ID] };

	it("keeps working with the same options: GitHub numeric ids are the admins", () => {
		const connection = githubAuth(options).create(context);
		expect(connection.providers.map((provider) => provider.id)).toEqual(["github"]);
		expect(connection.isAdmin(`github:${ADMIN_ID}`)).toBe(true);
		expect(connection.isAdmin("github:87654321")).toBe(false);
		expect(connection.devUserId).toBe(`github:${ADMIN_ID}`);
		expect(connection.requestHeaders).toBe(nextHost.requestHeaders);
	});

	it("the login API is under the admin API by default (`/api/cms/auth`), and the old path can be chosen", () => {
		expect(githubAuth(options).create(context).basePath).toBe(CMS_AUTH_BASE_PATH);
		expect(githubAuth({ ...options, basePath: "/api/auth/" }).create(context).basePath).toBe("/api/auth");
	});

	it("keeps the development bypass limited to development", () => {
		vi.stubEnv("NODE_ENV", "development");
		expect(githubAuth({ ...options, devBypass: true }).create(context).devBypass).toBe(true);
		vi.stubEnv("NODE_ENV", "production");
		vi.spyOn(console, "warn").mockImplementation(() => {});
		expect(githubAuth({ ...options, devBypass: true }).create(context).devBypass).toBe(false);
	});
});
