import { auth } from "@monti-cms/auth";
import { github } from "@monti-cms/auth/github";
import { createSite } from "@monti-cms/core/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { testConfig } from "../../../../core/test/site";
import { nextHost } from "../index";

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
