import Credentials from "@auth/core/providers/credentials";
import { afterEach, describe, expect, it, vi } from "vitest";
import { github } from "../github";
import type { LoginProvider } from "../provider";
import { connect, loginThrough, requestWith, stubOAuthServers } from "./harness";

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

/**
 * A second OAuth provider, written the way a `@monti-cms/auth-gitlab` package would: the Auth.js provider, labels, and how an account becomes an id.
 * It is the whole of a provider (the endpoints are fake here so no network is used).
 */
const gitlab = (options: { admins?: string[] } = {}): LoginProvider => ({
	id: "gitlab",
	name: "GitLab",
	label: { en: "Sign in with GitLab" },
	...(options.admins ? { admins: options.admins } : {}),
	setup: () => ({
		id: "gitlab",
		name: "GitLab",
		type: "oauth",
		clientId: "gl-id",
		clientSecret: "gl-secret",
		authorization: "https://gitlab.test/oauth/authorize",
		token: "https://gitlab.test/oauth/token",
		userinfo: "https://gitlab.test/api/v4/user",
		checks: ["state"],
		profile: (profile: { id: number; name: string }) => ({ id: String(profile.id), name: profile.name }),
	}),
	account: ({ user, account }) => ({ id: account.providerAccountId, ...(user.name ? { name: user.name } : {}) }),
});

const gitlabServer = {
	tokenUrl: "https://gitlab.test/oauth/token",
	userUrl: "https://gitlab.test/api/v4/user",
	user: { id: 77, name: "Joon Lee" },
};
const githubServer = {
	tokenUrl: "https://github.com/login/oauth/access_token",
	userUrl: "https://api.github.com/user",
	user: { id: 77, login: "mina", name: "Mina Park", email: "mina@example.com" },
};

describe("a second provider through the same interface", () => {
	const both = () =>
		connect({
			providers: [github({ clientId: "id", clientSecret: "secret", admins: ["77"] }), gitlab({ admins: ["gitlab:5"] })],
		});

	it("is listed on the login page next to the first, in the order given", () => {
		expect(both().providers.map(({ id, name }) => ({ id, name }))).toEqual([
			{ id: "github", name: "GitHub" },
			{ id: "gitlab", name: "GitLab" },
		]);
		expect(both().providers[1]?.label).toBe("Sign in with GitLab");
		expect(both().providers[1]).not.toHaveProperty("icon");
	});

	it("logs in through its own callback and is qualified with its own id", async () => {
		stubOAuthServers(gitlabServer);
		const cmsAuth = connect({ providers: [github(), gitlab({ admins: ["77"] })] });
		const { authorize, jar } = await loginThrough(cmsAuth, "gitlab");

		expect(authorize.origin).toBe("https://gitlab.test");
		expect(authorize.searchParams.get("redirect_uri")).toContain("/api/cms/auth/callback/gitlab");
		expect((await cmsAuth.session(requestWith(jar)))?.user).toEqual({
			id: "gitlab:77",
			accountId: "gitlab:77",
			name: "Joon Lee",
		});
		expect(cmsAuth.isAdmin("gitlab:77")).toBe(true);
	});

	it("an admin of one provider is not an admin of the other, even with the same id", async () => {
		stubOAuthServers(gitlabServer, githubServer);
		const cmsAuth = both();
		// GitHub account 77 is an admin; GitLab account 77 is not (GitLab's admin is 5).
		expect(cmsAuth.isAdmin("github:77")).toBe(true);
		expect(cmsAuth.isAdmin("gitlab:77")).toBe(false);
		expect(cmsAuth.isAdmin("gitlab:5")).toBe(true);
		expect(cmsAuth.isAdmin("github:5")).toBe(false);

		const { jar } = await loginThrough(cmsAuth, "gitlab");
		expect((await cmsAuth.session(requestWith(jar)))?.user?.accountId).toBe("gitlab:77");
	});

	it("a provider can refuse an account", async () => {
		stubOAuthServers(gitlabServer);
		vi.spyOn(console, "error").mockImplementation(() => {});
		const refusing: LoginProvider = { ...gitlab(), account: () => null };
		const cmsAuth = connect({ providers: [refusing] });
		const { jar } = await loginThrough(cmsAuth, "gitlab");
		expect(jar.names()).not.toContain("authjs.session-token");
	});

	it("refuses an admin listed on the wrong provider", () => {
		expect(() => connect({ providers: [github({ admins: ["gitlab:5"] }), gitlab()] })).toThrow(/belongs to gitlab/);
	});
});

describe("a credentials provider written outside this package fits the interface", () => {
	/**
	 * The shape of another credentials package: users live in the storage of a plugin the package owns (`context.storage`),
	 * and `authorize` is where hashing and rate limits go. Here the "storage" is a map. (`password()` is the shipped one.)
	 */
	const password = (): LoginProvider => {
		const users = new Map([["ana", { id: "u-1", hash: "x", name: "Ana" }]]);
		return {
			id: "password",
			name: "Email",
			label: { en: "Sign in with email" },
			setup: ({ storage }) => {
				void storage; // `storage("auth-password")` is where the users and the attempt counters live
				return Credentials({
					credentials: { username: {}, password: {} },
					authorize: async (credentials) => {
						const user = users.get(String(credentials?.username));
						return user && user.hash === credentials?.password ? { id: user.id, name: user.name } : null;
					},
				});
			},
			account: ({ user, account }) => ({ id: account.providerAccountId, ...(user.name ? { name: user.name } : {}) }),
		};
	};

	it("registers next to an OAuth provider, matches admins by its own ids, and is listed as a form login", () => {
		const cmsAuth = connect({ providers: [github(), { ...password(), admins: ["u-1"] }] });
		expect(cmsAuth.providers.map((provider) => provider.id)).toEqual(["github", "password"]);
		expect(cmsAuth.isAdmin("password:u-1")).toBe(true);
		expect(cmsAuth.isAdmin("password:u-2")).toBe(false);
		expect(cmsAuth.providers.map((provider) => provider.credentials === true)).toEqual([false, true]);
	});

	it("receives the plugin storage the core supplies", () => {
		const storage = vi.fn();
		const provider = password();
		const setup = vi.spyOn(provider, "setup");
		connect({ providers: [provider] }, { storage: storage as never });
		expect(setup).toHaveBeenCalledWith(expect.objectContaining({ storage }));
	});
});
