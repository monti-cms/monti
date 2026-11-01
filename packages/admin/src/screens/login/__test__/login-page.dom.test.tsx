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

/** The form the submit button with this name posts. */
const formOf = (submit: string) => {
	const form = (screen.getByRole("button", { name: submit }) as HTMLButtonElement).form;
	if (!form) throw new Error(`the ${submit} button posts no form`);
	return form;
};

/** The names of the fields a form posts: what the route it posts to reads. */
const fieldNames = (form: HTMLFormElement) =>
	[...form.elements].filter((element) => element instanceof HTMLInputElement).map((input) => input.name);

const show = async (cms: ReturnType<typeof passwordCms>, query: Record<string, string> = {}) =>
	render(await AdminLoginPage({ cms, server, searchParams: Promise.resolve(query) }));

describe("the login screen of the email and password login", () => {
	it("AUTH-A4 shows the create-the-first-admin form while no admin exists, posting to the first-admin route", async () => {
		await show(passwordCms(false));
		expect(screen.getByText(t("firstAdminTitle"))).toBeInTheDocument();
		const form = formOf(t("createFirstAdmin"));
		expect(form.getAttribute("action")).toContain("/v1/session/first-admin");
		expect(fieldNames(form)).toEqual(["email", "password", "confirm"]);
		expect(screen.queryByRole("button", { name: t("signInSubmit") })).toBeNull();
	});

	it("AUTH-A4 shows the sign-in form, not the first-admin form, once an admin exists", async () => {
		await show(passwordCms(true));
		expect(screen.queryByText(t("firstAdminTitle"))).toBeNull();
		const form = formOf(t("signInSubmit"));
		expect(form.getAttribute("action")).toContain("/v1/session/sign-in/password");
		expect(fieldNames(form)).toEqual(["email", "password"]);
		expect(screen.getByLabelText(t("password"))).toHaveAttribute("type", "password");
	});

	it("AUTH-A4 says why the last attempt did not work", async () => {
		await show(passwordCms(true), { error: "CredentialsSignin" });
		expect(screen.getByRole("alert").textContent).toBe(t("errorCredentials"));
		cleanup();
		await show(passwordCms(false), { error: "confirm" });
		expect(screen.getByRole("alert").textContent).toBe(t("errorConfirm"));
		cleanup();
		await show(passwordCms(true), { error: "closed" });
		expect(screen.getByRole("alert").textContent).toBe(t("errorClosed"));
	});

	it("AUTH-A4 keeps the plain button for a login that sends people to another service", async () => {
		const cms = fakeCms({
			config: testConfig,
			auth: { providers: [{ id: "github", name: "GitHub", label: "Sign in with GitHub" }] },
		});
		await show(cms as never);
		expect(fieldNames(formOf(t("signIn", { provider: "GitHub" })))).toEqual([]);
		expect([...document.forms].flatMap(fieldNames)).toEqual([]);
	});
});

describe("the header of the login screen", () => {
	it("AUTH-C3 titles the screen with the site name and says it is managed with Monti, on sign-in and on first-admin", async () => {
		const name = testConfig.site?.name ?? "";
		expect(name).not.toBe("");
		for (const cms of [passwordCms(true), passwordCms(false)]) {
			await show(cms);
			expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(name);
			expect(screen.getByText(t("managedWith"))).toBeInTheDocument();
			cleanup();
		}
	});
});
