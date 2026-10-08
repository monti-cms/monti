import { fakeCms } from "@monti-cms/core/testing";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { testConfig, testSite } from "../../../../../core/test/site";
import type { AdminServer } from "../../../host/server";
import { loginMessages } from "../messages";
import AdminLoginPage from "../page";

afterEach(cleanup);

/** The texts in the language of the test site, whichever it is. */
const t = testSite.createTranslator(loginMessages);

const server: AdminServer = {
	redirect: (href) => {
		throw new Error(`redirect ${href}`);
	},
	notFound: () => {
		throw new Error("not found");
	},
};

/** A login with the built-in accounts: `exists` says whether an admin has been created. */
const passwordCms = (exists: boolean) =>
	fakeCms({
		config: testConfig,
		auth: {
			providers: [{ id: "password", name: "Email and password", label: "Sign in", credentials: true }],
			accounts: {
				minPasswordLength: 10,
				hasAny: async () => exists,
				createFirst: async () => ({ ok: false, reason: "closed" }),
				resetPassword: async () => ({ ok: false, reason: "unknown" }),
			},
		},
	});

const show = async (cms: ReturnType<typeof passwordCms>, query: Record<string, string> = {}) =>
	render(await AdminLoginPage({ cms, server, searchParams: Promise.resolve(query) }));

describe("the login screen of the email and password login", () => {
	it("shows the create-the-first-admin form while no admin exists, posting to the first-admin route", async () => {
		const { container } = await show(passwordCms(false));
		expect(screen.getByText(t("firstAdminTitle"))).toBeTruthy();
		expect(container.querySelector("form")?.getAttribute("action")).toContain("/v1/session/first-admin");
		expect(
			["email", "password", "confirm"].map((name) => container.querySelector(`input[name=${name}]`) !== null),
		).toEqual([true, true, true]);
		expect(screen.queryByText(t("signInSubmit"), { selector: "button" })).toBeNull();
	});

	it("shows the sign-in form, not the first-admin form, once an admin exists", async () => {
		const { container } = await show(passwordCms(true));
		expect(screen.queryByText(t("firstAdminTitle"))).toBeNull();
		expect(container.querySelector("form")?.getAttribute("action")).toContain("/v1/session/sign-in/password");
		expect(container.querySelector("input[name=confirm]")).toBeNull();
		expect(container.querySelector("input[type=password]")).not.toBeNull();
		expect(screen.getByText(t("signInSubmit"), { selector: "button" })).toBeTruthy();
	});

	it("says why the last attempt did not work", async () => {
		await show(passwordCms(true), { error: "CredentialsSignin" });
		expect(screen.getByRole("alert").textContent).toBe(t("errorCredentials"));
		cleanup();
		await show(passwordCms(false), { error: "confirm" });
		expect(screen.getByRole("alert").textContent).toBe(t("errorConfirm"));
		cleanup();
		await show(passwordCms(true), { error: "closed" });
		expect(screen.getByRole("alert").textContent).toBe(t("errorClosed"));
	});

	it("keeps the plain button for a login that sends people to another service", async () => {
		const cms = fakeCms({
			config: testConfig,
			auth: { providers: [{ id: "github", name: "GitHub", label: "Sign in with GitHub" }] },
		});
		const { container } = await show(cms as never);
		expect(screen.getByText(t("signIn", { provider: "GitHub" }))).toBeTruthy();
		expect(container.querySelector("input")).toBeNull();
	});
});
