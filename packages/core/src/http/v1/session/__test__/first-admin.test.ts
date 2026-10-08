import { describe, expect, it, vi } from "vitest";
import { testConfig, testSite } from "../../../../../test/site";
import { fakeCms } from "../../../../cms";
import type { LoginAccounts } from "../../../../server/define";
import { POST as firstAdmin } from "../first-admin/route";
import { POST as signIn } from "../sign-in/[provider]/route";

const FORM = "application/x-www-form-urlencoded";

const form = (path: string, fields: Record<string, string>, headers: Record<string, string> = {}) =>
	new Request(`http://localhost/api/cms/${path}`, {
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

const call = (
	cms: ReturnType<typeof instance>["cms"],
	fields: Record<string, string>,
	headers?: Record<string, string>,
) => firstAdmin(form("v1/session/first-admin", fields, headers), { cms });

const GOOD = { email: "mina@example.com", password: "correct horse", confirm: "correct horse" };

describe("creating the first admin", () => {
	it("creates the account, signs it in with the same credentials and sends the browser to the admin", async () => {
		const { cms, created, signInFn } = instance();
		const response = await call(cms, GOOD);
		expect(created).toEqual(["mina@example.com"]);
		expect(response.status).toBe(302);
		expect(signInFn).toHaveBeenCalledWith("password", {
			redirectTo: testSite.adminUrl(),
			request: expect.any(Request),
			credentials: { email: "mina@example.com", password: "correct horse" },
		});
	});

	it("is refused by the server once an admin exists, whatever the form says, and signs nobody in", async () => {
		const { cms, created, signInFn } = instance();
		await call(cms, GOOD);
		signInFn.mockClear();
		const second = await call(cms, {
			email: "other@example.com",
			password: "another password",
			confirm: "another password",
		});
		expect(second.status).toBe(303);
		expect(second.headers.get("location")).toBe(`${testSite.adminUrl("/login")}?error=closed`);
		expect(created).toEqual(["mina@example.com"]);
		expect(signInFn).not.toHaveBeenCalled();
	});

	it("sends the browser back to the login screen when the two passwords differ, and creates nothing", async () => {
		const { cms, created } = instance();
		const response = await call(cms, { ...GOOD, confirm: "something else" });
		expect(response.headers.get("location")).toBe(`${testSite.adminUrl("/login")}?error=confirm`);
		expect(created).toEqual([]);
	});

	it("is 404 on a login that keeps no accounts", async () => {
		const { cms } = instance({ accounts: false });
		expect((await call(cms, GOOD)).status).toBe(404);
	});

	it("is refused for a post from another site", async () => {
		const { cms, created } = instance();
		const response = await call(cms, GOOD, { origin: "https://evil.example" });
		expect(response.status).toBe(403);
		expect(created).toEqual([]);
	});

	it("is served by the request handler without a login", async () => {
		const { cms, created } = instance();
		const response = await cms.handle(form("v1/session/first-admin", GOOD));
		expect(response.status).toBe(302);
		expect(created).toEqual(["mina@example.com"]);
	});
});

describe("signing in through the form of an email and password method", () => {
	it("passes the email and password of the form to the login", async () => {
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
