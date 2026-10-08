import { createSite } from "@monti-cms/core/client";
import { fakeCms } from "@monti-cms/core/testing";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testConfig } from "../../../../core/test/site";
import { AdminLayout } from "../layout";
import { SetupProblemScreen, setupProblemOf } from "../setup-problem";

const REPORTED = Symbol.for("monti.admin.setup-problem.reported");

// next-themes reads matchMedia for the system theme; jsdom does not provide it.
if (!window.matchMedia) {
	window.matchMedia = ((query: string) => ({
		matches: false,
		media: query,
		addEventListener: () => {},
		removeEventListener: () => {},
		addListener: () => {},
		removeListener: () => {},
		dispatchEvent: () => false,
		onchange: null,
	})) as typeof window.matchMedia;
}

const BROKEN = "[cms-auth] MONTI_SECRET is not set, so login sessions cannot be signed";

const brokenCms = () =>
	fakeCms({
		server: {
			auth: {
				name: "broken",
				create: () => {
					throw new Error(BROKEN);
				},
			},
		},
	});

let errors: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
	delete (globalThis as Record<symbol, unknown>)[REPORTED];
	errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	delete (globalThis as Record<symbol, unknown>)[REPORTED];
});

describe("setupProblemOf", () => {
	it("returns the message of the login that cannot start, and logs it once", () => {
		const cms = brokenCms();
		expect(setupProblemOf(cms)).toBe(BROKEN);
		expect(setupProblemOf(cms)).toBe(BROKEN);
		expect(errors).toHaveBeenCalledTimes(1);
		expect(String(errors.mock.calls[0]?.[0])).toContain(BROKEN);
	});

	it("returns undefined and logs nothing when the login works", () => {
		expect(setupProblemOf(fakeCms())).toBeUndefined();
		expect(errors).not.toHaveBeenCalled();
	});
});

describe("SetupProblemScreen", () => {
	it("shows the English text that points to monti doctor", () => {
		render(<SetupProblemScreen cms={fakeCms()} />);
		expect(screen.getByText("Not set up yet")).toBeTruthy();
		expect(screen.getByText(/monti doctor/)).toBeTruthy();
	});

	it("shows the Korean text for a Korean admin", () => {
		const cms = { site: createSite({ ...testConfig, admin: { ...testConfig.admin, locale: "ko" } }) };
		render(<SetupProblemScreen cms={cms as never} />);
		expect(screen.getByText("아직 설정되지 않았습니다")).toBeTruthy();
		expect(screen.getByText(/monti doctor/)).toBeTruthy();
	});

	it("does not show the error message to the visitor", () => {
		render(<SetupProblemScreen cms={fakeCms()} />);
		expect(document.body.textContent).not.toContain("MONTI_SECRET");
	});
});

describe("AdminLayout when the login is not set up", () => {
	it("renders the not-set-up screen instead of the admin, and logs the full message", async () => {
		const cms = brokenCms();
		render(await AdminLayout({ cms, themeProvider: false, toaster: false, children: <p>the admin</p> }));
		expect(screen.getByText("Not set up yet")).toBeTruthy();
		expect(screen.queryByText("the admin")).toBeNull();
		expect(document.body.textContent).not.toContain("MONTI_SECRET");
		expect(errors).toHaveBeenCalledTimes(1);
		expect(String(errors.mock.calls[0]?.[0])).toContain(BROKEN);
	});

	it("renders the admin as before when the login works", async () => {
		render(await AdminLayout({ cms: fakeCms(), themeProvider: false, toaster: false, children: <p>the admin</p> }));
		expect(screen.getByText("the admin")).toBeTruthy();
		expect(screen.queryByText("Not set up yet")).toBeNull();
		expect(errors).not.toHaveBeenCalled();
	});
});
