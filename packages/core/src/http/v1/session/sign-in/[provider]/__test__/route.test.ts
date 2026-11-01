import { describe, expect, it, vi } from "vitest";
import { testConfig, testSite } from "../../../../../../../test/site";
import { fakeCms } from "../../../../../../cms";
import type { LoginAccounts } from "../../../../../../server/define";
import { routeCaller } from "../../../../../../testing";
import { POST as signOutHandler } from "../../../sign-out/route";
import { POST as signInHandler } from "../route";

const signIn = routeCaller(signInHandler, "same-origin-form");
const signOut = routeCaller(signOutHandler, "same-origin-form");

const FORM = "application/x-www-form-urlencoded";

const post = (path: string, headers: Record<string, string> = { origin: "http://localhost", "content-type": FORM }) =>
	new Request(`http://localhost/api/monti/${path}`, { method: "POST", headers, body: "" });

/** What a host framework throws to leave a handler (Next.js throws a redirect). Only the login connection knows it is one. */
class HostRedirect extends Error {}

type Auth = NonNullable<NonNullable<Parameters<typeof fakeCms>[0]>["auth"]>;

const instance = (auth: { signIn?: Auth["signIn"]; signOut?: Auth["signOut"] } = {}) =>
	fakeCms({
		config: testConfig,
		auth: {
			providers: [{ id: "github", name: "GitHub", label: "Sign in with GitHub" }],
			signIn: auth.signIn ?? vi.fn(async () => undefined),
			signOut: auth.signOut ?? vi.fn(async () => undefined),
			rethrow: (error) => {
				if (error instanceof HostRedirect) throw error;
			},
		},
	});

describe("sign in and out of the admin through the instance's login connection", () => {
	it("AUTH-L4 signing in starts the login method the form names, and sends the browser to the admin afterwards", async () => {
		const signInFn = vi.fn(async () => undefined);
		const cms = instance({ signIn: signInFn });
		const response = await signIn(post("v1/session/sign-in/github"), {
			params: Promise.resolve({ provider: "github" }),
			cms,
		});
		expect(response.status).toBe(204);
		expect(signInFn).toHaveBeenCalledWith("github", { redirectTo: testSite.adminUrl(), request: expect.any(Request) });
	});

	it("AUTH-C2 a login connection that answers with a Response (a redirect carrying cookies) has it returned as it is", async () => {
		const redirect = new Response(null, {
			status: 302,
			headers: { location: "https://github.com/login/oauth/authorize", "set-cookie": "authjs.state=x; Path=/" },
		});
		const cms = instance({ signIn: vi.fn(async () => redirect), signOut: vi.fn(async () => redirect) });
		const signedIn = await signIn(post("v1/session/sign-in/github"), {
			params: Promise.resolve({ provider: "github" }),
			cms,
		});
		expect(signedIn).toBe(redirect);
		expect(await signOut(post("v1/session/sign-out"), { params: Promise.resolve({}), cms })).toBe(redirect);
	});

	it("AUTH-C1 a login method the instance does not offer is 404 and nothing is started", async () => {
		const signInFn = vi.fn(async () => undefined);
		const response = await signIn(post("v1/session/sign-in/gitlab"), {
			params: Promise.resolve({ provider: "gitlab" }),
			cms: instance({ signIn: signInFn }),
		});
		expect(response.status).toBe(404);
		expect(signInFn).not.toHaveBeenCalled();
	});

	it("AUTH-C2 the login connection redirects by throwing, and that reaches the host instead of becoming an error response", async () => {
		const cms = instance({
			signIn: vi.fn(async () => {
				throw new HostRedirect("https://github.com/login/oauth/authorize");
			}),
			signOut: vi.fn(async () => {
				throw new HostRedirect("/admin/login");
			}),
		});
		await expect(
			signIn(post("v1/session/sign-in/github"), { params: Promise.resolve({ provider: "github" }), cms }),
		).rejects.toBeInstanceOf(HostRedirect);
		await expect(signOut(post("v1/session/sign-out"), { cms })).rejects.toBeInstanceOf(HostRedirect);
	});

	it("AUTH-C2 any other failure of the login connection is an error response", async () => {
		const cms = instance({
			signIn: vi.fn(async () => {
				throw new Error("provider is down");
			}),
		});
		const response = await signIn(post("v1/session/sign-in/github"), {
			params: Promise.resolve({ provider: "github" }),
			cms,
		});
		expect(response.status).toBe(500);
	});

	it("AUTH-L4 a post from another site is refused before anything happens", async () => {
		const signInFn = vi.fn(async () => undefined);
		const signOutFn = vi.fn(async () => undefined);
		const cms = instance({ signIn: signInFn, signOut: signOutFn });
		const foreign = { origin: "https://evil.example", "content-type": FORM };
		expect(
			(
				await signIn(post("v1/session/sign-in/github", foreign), {
					params: Promise.resolve({ provider: "github" }),
					cms,
				})
			).status,
		).toBe(403);
		expect((await signOut(post("v1/session/sign-out", foreign), { cms })).status).toBe(403);
		expect(signInFn).not.toHaveBeenCalled();
		expect(signOutFn).not.toHaveBeenCalled();
	});

	it("AUTH-L4 is served by the request handler without a login (it is how one signs in)", async () => {
		const signInFn = vi.fn(async () => undefined);
		const cms = instance({ signIn: signInFn });
		const response = await cms.handle(post("v1/session/sign-in/github"));
		expect(response.status).toBe(204);
		expect(signInFn).toHaveBeenCalledTimes(1);
	});
});

describe("signing in through the form of an email and password method", () => {
	const form = (path: string, fields: Record<string, string>, headers: Record<string, string> = {}) =>
		new Request(`http://localhost/api/monti/${path}`, {
			method: "POST",
			headers: { origin: "http://localhost", "content-type": FORM, ...headers },
			body: new URLSearchParams(fields),
		});

	/** A login with the accounts stubbed by a list: the first admin is allowed only while the list is empty. */
	const instance = (options: { accounts?: boolean } = {}) => {
		const created: string[] = [];
		const accounts: LoginAccounts = {
			minPasswordLength: 10,
			hasAny: async () => created.length > 0,
			createFirst: async ({ email }) => {
				if (created.length > 0) return { ok: false, reason: "closed" };
				created.push(email);
				return { ok: true };
			},
			resetPassword: async () => ({ ok: false, reason: "unknown" }),
		};
		const signInFn = vi.fn(
			async (..._args: unknown[]) => new Response(null, { status: 302, headers: { location: "/studio" } }),
		);
		const cms = fakeCms({
			config: testConfig,
			auth: {
				providers: [{ id: "password", name: "Email and password", label: "Sign in", credentials: true }],
				signIn: signInFn,
				...(options.accounts === false ? {} : { accounts }),
			},
		});
		return { cms, created, signInFn };
	};

	it("AUTH-L2 passes the email and password of the form to the login", async () => {
		const { cms, signInFn } = instance();
		await signIn(form("v1/session/sign-in/password", { email: "mina@example.com", password: "correct horse" }), {
			params: Promise.resolve({ provider: "password" }),
			cms,
		});
		expect(signInFn).toHaveBeenCalledWith("password", {
			redirectTo: testSite.adminUrl(),
			request: expect.any(Request),
			credentials: { email: "mina@example.com", password: "correct horse" },
		});
	});
});
