import { describe, expect, it, vi } from "vitest";
import { fakeCms } from "../../../../cms";
import { adminUrl } from "../../../../core/admin-paths";
import { POST as signIn } from "../sign-in/[provider]/route";
import { POST as signOut } from "../sign-out/route";

const FORM = "application/x-www-form-urlencoded";

const post = (path: string, headers: Record<string, string> = { origin: "http://localhost", "content-type": FORM }) =>
	new Request(`http://localhost/api/cms/${path}`, { method: "POST", headers, body: "" });

/** What a host framework throws to leave a handler (Next.js throws a redirect). Only the login connection knows it is one. */
class HostRedirect extends Error {}

type Auth = NonNullable<NonNullable<Parameters<typeof fakeCms>[0]>["auth"]>;

const instance = (auth: { signIn?: Auth["signIn"]; signOut?: Auth["signOut"] } = {}) =>
	fakeCms({
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
	it("signing in starts the login method the form names, and sends the browser to the admin afterwards", async () => {
		const signInFn = vi.fn(async () => undefined);
		const cms = instance({ signIn: signInFn });
		const response = await signIn(post("v1/session/sign-in/github"), {
			params: Promise.resolve({ provider: "github" }),
			cms,
		});
		expect(response.status).toBe(204);
		expect(signInFn).toHaveBeenCalledWith("github", { redirectTo: adminUrl() });
	});

	it("a login method the instance does not offer is 404 and nothing is started", async () => {
		const signInFn = vi.fn(async () => undefined);
		const response = await signIn(post("v1/session/sign-in/gitlab"), {
			params: Promise.resolve({ provider: "gitlab" }),
			cms: instance({ signIn: signInFn }),
		});
		expect(response.status).toBe(404);
		expect(signInFn).not.toHaveBeenCalled();
	});

	it("the login connection redirects by throwing, and that reaches the host instead of becoming an error response", async () => {
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

	it("any other failure of the login connection is an error response", async () => {
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

	it("signing out ends the session and sends the browser to the login screen", async () => {
		const signOutFn = vi.fn(async () => undefined);
		const response = await signOut(post("v1/session/sign-out"), { cms: instance({ signOut: signOutFn }) });
		expect(response.status).toBe(204);
		expect(signOutFn).toHaveBeenCalledWith({ redirectTo: adminUrl("/login") });
	});

	it("a post from another site is refused before anything happens", async () => {
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

	it("accepts a browser form post and JSON, but no other body type", async () => {
		const cms = instance();
		const call = (contentType: string) =>
			signOut(post("v1/session/sign-out", { origin: "http://localhost", "content-type": contentType }), { cms });
		expect((await call(FORM)).status).toBe(204);
		expect((await call("application/json")).status).toBe(204);
		expect((await call("text/plain")).status).toBe(415);
	});

	it("is served by the request handler without a login (it is how one signs in)", async () => {
		const signInFn = vi.fn(async () => undefined);
		const cms = instance({ signIn: signInFn });
		const response = await cms.handle(post("v1/session/sign-in/github"));
		expect(response.status).toBe(204);
		expect(signInFn).toHaveBeenCalledTimes(1);
	});
});
