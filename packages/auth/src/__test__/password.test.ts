import { createMemoryPluginStorage } from "@monti-cms/core/testing";
import { describe, expect, it } from "vitest";
import { auth } from "../auth";
import { MIN_PASSWORD_LENGTH, normalizeEmail, password } from "../password";
import { hashPassword, verifyPassword } from "../password-hash";
import { CookieJar, connectWithEnv, ORIGIN, requestWith } from "./harness";

const GOOD = "correct horse battery";

/** A login connection over in-memory storage, and the browser that talks to it. */
const setup = () => {
	const memory = createMemoryPluginStorage();
	const cmsAuth = connectWithEnv({ providers: [password()] }, { storage: memory.storage });
	const accounts = cmsAuth.accounts;
	if (!accounts) throw new Error("the password login has accounts");
	const signIn = async (email: string, secret: string, jar = new CookieJar()) => {
		const response = (await cmsAuth.signIn("password", {
			redirectTo: "/studio",
			request: new Request(`${ORIGIN}/api/cms/v1/session/sign-in/password`, { method: "POST" }),
			credentials: { email, password: secret },
		})) as Response;
		jar.store(response);
		return { response, jar };
	};
	return { cmsAuth, accounts, signIn, memory };
};

describe("hashing", () => {
	it("verifies the password a hash was made from, and no other", async () => {
		const hash = await hashPassword(GOOD);
		expect(await verifyPassword(GOOD, hash)).toBe(true);
		expect(await verifyPassword(`${GOOD}!`, hash)).toBe(false);
		expect(await verifyPassword("", hash)).toBe(false);
	});

	it("uses a salt per hash and does not contain the password", async () => {
		const [a, b] = await Promise.all([hashPassword(GOOD), hashPassword(GOOD)]);
		expect(a).not.toBe(b);
		expect(a).not.toContain(GOOD);
		expect(await verifyPassword(GOOD, b)).toBe(true);
	});

	it("never matches a stored value that is not one of its hashes", async () => {
		for (const stored of ["", GOOD, "scrypt$x", "scrypt$0$0$0$a$b", "bcrypt$1$2$3$4$5"]) {
			expect(await verifyPassword(GOOD, stored)).toBe(false);
		}
	});
});

describe("the first admin", () => {
	it("is created while no account exists, and the screen's check says so", async () => {
		const { accounts } = setup();
		expect(await accounts.hasAny()).toBe(false);
		expect(await accounts.createFirst({ email: "Mina@Example.com ", password: GOOD })).toEqual({ ok: true });
		expect(await accounts.hasAny()).toBe(true);
	});

	it("is refused for a second attempt, even with another email", async () => {
		const { accounts } = setup();
		await accounts.createFirst({ email: "mina@example.com", password: GOOD });
		expect(await accounts.createFirst({ email: "other@example.com", password: GOOD })).toEqual({
			ok: false,
			reason: "closed",
		});
	});

	it("lets only one of two simultaneous attempts through", async () => {
		const { accounts } = setup();
		const results = await Promise.all([
			accounts.createFirst({ email: "a@example.com", password: GOOD }),
			accounts.createFirst({ email: "b@example.com", password: GOOD }),
		]);
		expect(results.filter((result) => result.ok)).toHaveLength(1);
		expect((await Promise.all([accounts.hasAny()]))[0]).toBe(true);
	});

	it("refuses an email that is not one and a short password, and stays open", async () => {
		const { accounts } = setup();
		expect(await accounts.createFirst({ email: "mina", password: GOOD })).toEqual({ ok: false, reason: "email" });
		expect(
			await accounts.createFirst({ email: "mina@example.com", password: "x".repeat(MIN_PASSWORD_LENGTH - 1) }),
		).toEqual({
			ok: false,
			reason: "password",
		});
		expect(await accounts.hasAny()).toBe(false);
	});
});

describe("signing in with email and password", () => {
	it("the right password gives a session of an admin, whatever the case of the email", async () => {
		const { cmsAuth, accounts, signIn } = setup();
		await accounts.createFirst({ email: "mina@example.com", password: GOOD });
		const { response, jar } = await signIn("MINA@example.com", GOOD);
		expect(response.status).toBe(302);
		expect(new URL(response.headers.get("location") ?? "", ORIGIN).pathname).toBe("/studio");
		const session = await cmsAuth.session(requestWith(jar));
		expect(session?.user?.accountId).toBe("password:mina@example.com");
		expect(cmsAuth.isAdmin(session?.user?.accountId)).toBe(true);
	});

	it("a wrong password gives no session and sends the browser back to the login screen with an error", async () => {
		const { cmsAuth, accounts, signIn } = setup();
		await accounts.createFirst({ email: "mina@example.com", password: GOOD });
		const { response, jar } = await signIn("mina@example.com", "not the password");
		expect(new URL(response.headers.get("location") ?? "", ORIGIN).pathname).toBe("/studio/login");
		expect(response.headers.get("location")).toContain("error=");
		expect(await cmsAuth.session(requestWith(jar))).toBeNull();
	});

	it("an unknown email is refused the same way", async () => {
		const { cmsAuth, accounts, signIn } = setup();
		await accounts.createFirst({ email: "mina@example.com", password: GOOD });
		const { response, jar } = await signIn("someone@example.com", GOOD);
		expect(response.headers.get("location")).toContain("error=");
		expect(await cmsAuth.session(requestWith(jar))).toBeNull();
	});

	it("refuses an email after repeated failures, even with the right password", async () => {
		const { cmsAuth, accounts, signIn } = setup();
		await accounts.createFirst({ email: "mina@example.com", password: GOOD });
		for (let attempt = 0; attempt < 5; attempt++) await signIn("mina@example.com", "wrong password");
		const locked = await signIn("mina@example.com", GOOD);
		expect(await cmsAuth.session(requestWith(locked.jar))).toBeNull();
	});

	it("an account id that no one signed in as is not an admin", () => {
		const { cmsAuth } = setup();
		expect(cmsAuth.isAdmin("password:not-an-email")).toBe(false);
		expect(cmsAuth.isAdmin("github:1")).toBe(false);
	});

	it("is listed as a form login, and has no admin warning", () => {
		const { cmsAuth } = setup();
		expect(cmsAuth.providers).toEqual([expect.objectContaining({ id: "password", credentials: true })]);
	});
});

describe("resetting a password", () => {
	it("replaces the password: the old one stops working and the new one signs in", async () => {
		const { cmsAuth, accounts, signIn } = setup();
		await accounts.createFirst({ email: "mina@example.com", password: GOOD });
		expect(await accounts.resetPassword({ email: "MINA@example.com", password: "a brand new password" })).toEqual({
			ok: true,
		});
		expect(await cmsAuth.session(requestWith((await signIn("mina@example.com", GOOD)).jar))).toBeNull();
		const fresh = await signIn("mina@example.com", "a brand new password");
		expect((await cmsAuth.session(requestWith(fresh.jar)))?.user?.accountId).toBe("password:mina@example.com");
	});

	it("is refused for an email without an account and for a short password", async () => {
		const { accounts } = setup();
		await accounts.createFirst({ email: "mina@example.com", password: GOOD });
		expect(await accounts.resetPassword({ email: "nobody@example.com", password: GOOD })).toEqual({
			ok: false,
			reason: "unknown",
		});
		expect(await accounts.resetPassword({ email: "mina@example.com", password: "short" })).toEqual({
			ok: false,
			reason: "password",
		});
	});
});

describe("emails", () => {
	it("are trimmed and lower cased, and must look like an email", () => {
		expect(normalizeEmail("  Mina@Example.COM ")).toBe("mina@example.com");
		for (const bad of ["", "mina", "mina@", "@example.com", "a b@example.com"]) expect(normalizeEmail(bad)).toBeNull();
	});
});

it("builds with the provider alone and no admin list", () => {
	expect(() => auth({ providers: [password()] })).not.toThrow();
});
