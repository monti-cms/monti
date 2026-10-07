import { AuthError, CmsAuthGateway } from "@monti-cms/core/adapters/auth";
import { afterEach, describe, expect, it, vi } from "vitest";
import { auth } from "../auth";
import { github } from "../github";
import { githubLabel } from "../messages";
import { CookieJar, connect, loginThrough, ORIGIN, requestWith, stubOAuthServers } from "./harness";

const ADMIN_ID = "12345678";
const github123 = { tokenUrl: "https://github.com/login/oauth/access_token", userUrl: "https://api.github.com/user" };
const githubUser = (id: number, login = "mina") => ({
	...github123,
	user: { id, login, name: "Mina Park", email: null },
});

afterEach(() => {
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe("the OAuth flow (GitHub, mocked)", () => {
	const connection = () =>
		connect({ providers: [github({ clientId: "id", clientSecret: "secret", admins: [ADMIN_ID] })] });

	it("sign-in answers with a redirect to GitHub that carries the state cookies, and the callback ends in a session cookie", async () => {
		stubOAuthServers(githubUser(Number(ADMIN_ID)));
		const cmsAuth = connection();
		const { jar, authorize, callback } = await loginThrough(cmsAuth, "github");

		expect(authorize.origin + authorize.pathname).toBe("https://github.com/login/oauth/authorize");
		expect(authorize.searchParams.get("client_id")).toBe("id");
		expect(authorize.searchParams.get("redirect_uri")).toBe(`${ORIGIN}/api/cms/auth/callback/github`);
		expect(callback.status).toBe(302);
		expect(new URL(callback.headers.get("location") ?? "", ORIGIN).pathname).toBe("/studio");
		expect(jar.names()).toContain("authjs.session-token");

		const session = await cmsAuth.session(requestWith(jar));
		expect(session?.user).toEqual({ id: `github:${ADMIN_ID}`, accountId: `github:${ADMIN_ID}`, name: "Mina Park" });
		expect(cmsAuth.isAdmin(session?.user?.accountId)).toBe(true);
	});

	/** The same login connection, inside a request of the browser that holds `jar`: the framework (the host) supplies that request's headers. */
	const insideRequestOf = (jar: CookieJar) =>
		connect({
			providers: [github({ clientId: "id", clientSecret: "secret", admins: [ADMIN_ID] })],
			host: { requestHeaders: async () => requestWith(jar).headers },
		});

	it("reads the session from the headers the host supplies when no request is passed", async () => {
		stubOAuthServers(githubUser(Number(ADMIN_ID)));
		const { jar } = await loginThrough(connection(), "github");
		expect((await insideRequestOf(jar).session())?.user?.accountId).toBe(`github:${ADMIN_ID}`);
		expect(await connection().session()).toBeNull();
	});

	it("a signed-in person who is not an admin has a session but is denied by the gateway", async () => {
		stubOAuthServers(githubUser(99999999, "other"));
		const { jar } = await loginThrough(connection(), "github");
		const cmsAuth = insideRequestOf(jar);

		expect((await cmsAuth.session())?.user?.accountId).toBe("github:99999999");
		expect(cmsAuth.isAdmin("github:99999999")).toBe(false);
		await expect(new CmsAuthGateway(() => cmsAuth).verifyAdmin()).rejects.toMatchObject({ code: "forbidden" });
	});

	it("the gateway lets an admin through, with the name GitHub gives", async () => {
		stubOAuthServers(githubUser(Number(ADMIN_ID)));
		const { jar } = await loginThrough(connection(), "github");
		const result = await new CmsAuthGateway(() => insideRequestOf(jar)).verifyAdmin();
		expect(result).toEqual({
			userId: `github:${ADMIN_ID}`,
			accountId: `github:${ADMIN_ID}`,
			isAdmin: true,
			name: "Mina Park",
		});
	});

	it("without a session cookie, or with a tampered one, there is no session", async () => {
		stubOAuthServers(githubUser(Number(ADMIN_ID)));
		const cmsAuth = connection();
		expect(await cmsAuth.session(new Request(`${ORIGIN}/studio`))).toBeNull();
		const { jar } = await loginThrough(cmsAuth, "github");
		const forged = new CookieJar();
		forged.store(new Response(null, { headers: { "set-cookie": "authjs.session-token=eyJhbGciOiJkaXIifQ.x.y.z.w" } }));
		expect(await cmsAuth.session(requestWith(forged))).toBeNull();
		expect(jar.names()).toContain("authjs.session-token");
	});

	it("a callback without the state of a sign-in that started here does not log in", async () => {
		stubOAuthServers(githubUser(Number(ADMIN_ID)));
		const cmsAuth = connection();
		const callback = await cmsAuth.handlers.GET(
			new Request(`${ORIGIN}/api/cms/auth/callback/github?code=code&state=forged`),
		);
		const jar = new CookieJar();
		jar.store(callback);
		expect(jar.names()).not.toContain("authjs.session-token");
		expect(await cmsAuth.session(requestWith(jar))).toBeNull();
	});

	it("sign-out clears the session cookie", async () => {
		stubOAuthServers(githubUser(Number(ADMIN_ID)));
		const cmsAuth = connection();
		const { jar } = await loginThrough(cmsAuth, "github");
		const signOut = (await cmsAuth.signOut({
			redirectTo: "/studio/login",
			request: new Request(`${ORIGIN}/api/cms/v1/session/sign-out`, {
				method: "POST",
				headers: { cookie: jar.header() },
			}),
		})) as Response;
		expect(signOut.status).toBe(302);
		jar.store(signOut);
		expect(jar.names()).not.toContain("authjs.session-token");
		expect(await cmsAuth.session(requestWith(jar))).toBeNull();
	});

	it("network requests keep the CSRF check: a plain POST to sign in is refused", async () => {
		const cmsAuth = connection();
		const response = await cmsAuth.handlers.POST(
			new Request(`${ORIGIN}/api/cms/auth/signin/github`, {
				method: "POST",
				headers: { "content-type": "application/x-www-form-urlencoded" },
				body: "callbackUrl=%2Fstudio",
			}),
		);
		expect(response.headers.get("location") ?? "").not.toContain("github.com/login/oauth");
	});

	it("an unknown sign-in method is an error", async () => {
		await expect(
			connection().signIn("gitlab", { request: new Request(`${ORIGIN}/x`, { method: "POST" }) }),
		).rejects.toThrow(/Unknown sign-in method/);
	});

	it("lists the providers for the login page, with a label that follows the admin language", () => {
		const [entry] = connection().providers;
		expect(entry?.id).toBe("github");
		expect(entry?.name).toBe("GitHub");
		expect([githubLabel.en, githubLabel.ko]).toContain(entry?.label);
		expect(entry?.icon).toMatch(/^data:image\/svg\+xml,/);
	});
});

describe("who is an admin", () => {
	const adminsOf = (
		admins: (string | undefined)[],
		extra: Parameters<typeof auth>[0] extends infer O ? Partial<O> : never = {},
	) => connect({ providers: [github({ admins })], ...extra });

	it("matches GitHub ids qualified as `github:<id>`, with or without the prefix in the config", () => {
		const bare = adminsOf([ADMIN_ID]);
		const qualified = adminsOf([`github:${ADMIN_ID}`]);
		for (const cmsAuth of [bare, qualified]) {
			expect(cmsAuth.isAdmin(`github:${ADMIN_ID}`)).toBe(true);
			expect(cmsAuth.isAdmin("github:87654321")).toBe(false);
		}
	});

	it("ignores leading zeros, and never matches a bare id without the provider prefix", () => {
		const cmsAuth = adminsOf([`000${ADMIN_ID}`]);
		expect(cmsAuth.isAdmin(`github:${ADMIN_ID}`)).toBe(true);
		expect(cmsAuth.isAdmin(`github:0${ADMIN_ID}`)).toBe(true);
		expect(cmsAuth.isAdmin(ADMIN_ID)).toBe(false);
		expect(cmsAuth.isAdmin(`gitlab:${ADMIN_ID}`)).toBe(false);
	});

	it("skips unset entries, and has no admin when none is set", () => {
		const cmsAuth = adminsOf([undefined, " "]);
		expect(cmsAuth.isAdmin("github:1")).toBe(false);
		expect(cmsAuth.isAdmin(undefined)).toBe(false);
		expect(cmsAuth.isAdmin("")).toBe(false);
		expect(cmsAuth.devUserId).toBe("local-dev");
	});

	it("does not accept a login name (it can be renamed and taken), and says so", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const cmsAuth = adminsOf(["octocat"]);
		expect(cmsAuth.isAdmin("github:octocat")).toBe(false);
		expect(warn).toHaveBeenCalledWith(expect.stringContaining('Ignored the admin "octocat"'));
	});

	it("takes qualified admins from the top-level option too, and refuses ones of an unknown provider", () => {
		const cmsAuth = connect({ providers: [github()], admins: [`github:${ADMIN_ID}`] });
		expect(cmsAuth.isAdmin(`github:${ADMIN_ID}`)).toBe(true);
		expect(() => connect({ providers: [github()], admins: ["gitlab:1"] })).toThrow(/qualified account id/);
		expect(() => connect({ providers: [github()], admins: [ADMIN_ID] })).toThrow(/qualified account id/);
	});

	it("the development admin is the first admin, qualified", () => {
		expect(adminsOf([ADMIN_ID]).devUserId).toBe(`github:${ADMIN_ID}`);
	});

	it("refuses an empty or duplicated provider list", () => {
		expect(() => auth({ providers: [] })).toThrow(/no provider.*Where:.*providers.*Fix:/s);
		expect(() => auth({ providers: [github(), github()] })).toThrow(/Two providers/);
	});
});

describe("development bypass", () => {
	const loopback = new Headers({ host: "localhost:3000", "x-forwarded-for": "::1" });
	const remote = new Headers({ host: "cms.example.com", "x-forwarded-for": "203.0.113.9" });
	/** `devBypass` is left unset by default: the default is what is under test. */
	const gatewayFor = (headers: Headers, devBypass?: boolean) => {
		const cmsAuth = connect({
			providers: [github({ admins: [ADMIN_ID] })],
			devBypass,
			host: { requestHeaders: async () => headers },
		});
		return new CmsAuthGateway(() => cmsAuth);
	};

	it("is on by default in development, for a request from this machine: the first admin, with no devBypass option", async () => {
		vi.stubEnv("NODE_ENV", "development");
		vi.spyOn(console, "warn").mockImplementation(() => {});
		expect(await gatewayFor(loopback).verifyAdmin()).toMatchObject({ accountId: `github:${ADMIN_ID}`, isAdmin: true });
	});

	it("does not apply to a request from another host, even in development", async () => {
		vi.stubEnv("NODE_ENV", "development");
		vi.spyOn(console, "warn").mockImplementation(() => {});
		await expect(gatewayFor(remote).verifyAdmin()).rejects.toMatchObject({ code: "unauthorized" });
		const forwarded = new Headers({ host: "localhost:3000", "x-forwarded-host": "cms.example.com" });
		await expect(gatewayFor(forwarded).verifyAdmin()).rejects.toBeInstanceOf(AuthError);
	});

	it("never applies in production, whatever is asked, and in development it can be turned off", async () => {
		vi.spyOn(console, "warn").mockImplementation(() => {});
		vi.stubEnv("NODE_ENV", "production");
		await expect(gatewayFor(loopback).verifyAdmin()).rejects.toMatchObject({ code: "unauthorized" });
		await expect(gatewayFor(loopback, true).verifyAdmin()).rejects.toMatchObject({ code: "unauthorized" });
		vi.stubEnv("NODE_ENV", "development");
		await expect(gatewayFor(loopback, false).verifyAdmin()).rejects.toMatchObject({ code: "unauthorized" });
	});

	it("refuses to start when asked for in development mode on something that looks deployed", () => {
		vi.stubEnv("NODE_ENV", "development");
		vi.stubEnv("VERCEL", "1");
		expect(() => gatewayFor(loopback, true)).toThrow(/Refusing to start with devBypass/);
	});

	it("by default stays off, without stopping the server, on something that looks deployed", async () => {
		vi.stubEnv("NODE_ENV", "development");
		vi.stubEnv("VERCEL", "1");
		vi.spyOn(console, "warn").mockImplementation(() => {});
		await expect(gatewayFor(loopback).verifyAdmin()).rejects.toMatchObject({ code: "unauthorized" });
	});

	it("without the host's request headers it never applies", async () => {
		vi.stubEnv("NODE_ENV", "development");
		vi.spyOn(console, "warn").mockImplementation(() => {});
		const cmsAuth = connect({ providers: [github({ admins: [ADMIN_ID] })], devBypass: true });
		await expect(new CmsAuthGateway(() => cmsAuth).verifyAdmin()).rejects.toMatchObject({ code: "unauthorized" });
	});
});

describe("host trust", () => {
	const github1 = () => github({ clientId: "id", clientSecret: "secret", admins: [ADMIN_ID] });
	const signInAt = (cmsAuth: ReturnType<typeof connect>, headers: Record<string, string>) =>
		cmsAuth.signIn("github", {
			redirectTo: "/studio",
			request: new Request(`${ORIGIN}/api/cms/v1/session/sign-in/github`, { method: "POST", headers }),
		}) as Promise<Response>;
	const redirectUri = (response: Response) =>
		new URL(response.headers.get("location") ?? "").searchParams.get("redirect_uri");

	it("an untrusted host cannot sign in (no redirect to the provider)", async () => {
		vi.stubEnv("AUTH_URL", "");
		vi.stubEnv("NEXTAUTH_URL", "");
		vi.spyOn(console, "error").mockImplementation(() => {});
		const response = await signInAt(connect({ providers: [github1()] }, { trustHost: false }), {});
		expect(response.headers.get("location") ?? "").not.toContain("github.com");
		expect(response.status).toBe(500);
	});

	it("a trusted host builds the callback URL from the forwarded host", async () => {
		vi.stubEnv("AUTH_URL", "");
		vi.stubEnv("NEXTAUTH_URL", "");
		const response = await signInAt(connect({ providers: [github1()] }, { trustHost: true }), {
			host: "internal:3000",
			"x-forwarded-host": "cms.example.com",
			"x-forwarded-proto": "https",
		});
		expect(redirectUri(response)).toBe("https://cms.example.com/api/cms/auth/callback/github");
	});

	it("AUTH_URL pins the origin, and a forwarded host is then ignored", async () => {
		vi.stubEnv("AUTH_URL", "https://cms.example.com");
		const cmsAuth = connect({ providers: [github1()] }, { trustHost: false });
		const response = await signInAt(cmsAuth, { host: "evil.example", "x-forwarded-host": "evil.example" });
		expect(redirectUri(response)).toBe("https://cms.example.com/api/cms/auth/callback/github");
	});

	it("warns in production when the host is not trusted and there is no AUTH_URL", () => {
		vi.stubEnv("NODE_ENV", "production");
		vi.stubEnv("AUTH_URL", "");
		vi.stubEnv("NEXTAUTH_URL", "");
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		connect({ providers: [github1()] }, { trustHost: false });
		expect(warn).toHaveBeenCalledWith(expect.stringContaining("The host is not trusted"));
	});
});

describe("the login path", () => {
	it("is under the admin API by default, and another path can be chosen", () => {
		expect(connect({ providers: [github()] }).basePath).toBe("/api/cms/auth");
		expect(connect({ providers: [github()], basePath: "/api/auth/" }).basePath).toBe("/api/auth");
	});
});
