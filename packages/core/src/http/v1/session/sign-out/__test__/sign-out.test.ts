import { describe, expect, it, vi } from "vitest";
import { testConfig, testSite } from "../../../../../../test/site";
import { fakeCms } from "../../../../../cms";
import { routeCaller } from "../../../../../testing";
import { POST as signOutHandler } from "../route";

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
	it("AUTH-L4 signing out ends the session and sends the browser to the login screen", async () => {
		const signOutFn = vi.fn(async () => undefined);
		const response = await signOut(post("v1/session/sign-out"), { cms: instance({ signOut: signOutFn }) });
		expect(response.status).toBe(204);
		expect(signOutFn).toHaveBeenCalledWith({ redirectTo: testSite.adminUrl("/login"), request: expect.any(Request) });
	});

	it("AUTH-L4 accepts a browser form post and JSON, but no other body type", async () => {
		const cms = instance();
		const call = (contentType: string) =>
			signOut(post("v1/session/sign-out", { origin: "http://localhost", "content-type": contentType }), { cms });
		expect((await call(FORM)).status).toBe(204);
		expect((await call("application/json")).status).toBe(204);
		expect((await call("text/plain")).status).toBe(415);
	});
});
