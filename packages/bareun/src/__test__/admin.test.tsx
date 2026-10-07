import { useCmsAdminComponents } from "@monti-cms/admin";
import { SiteProvider } from "@monti-cms/core/client";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { testSite } from "../../test/site";
import bareunAdmin from "../admin";
import { bareun } from "../index";

afterEach(cleanup);

function Checkers() {
	const { textCheckers = [] } = useCmsAdminComponents();
	return <p>{textCheckers.map((checker) => checker.id).join(",")}</p>;
}

describe("Bareun checker admin side", () => {
	it("the provider registers Bareun as the admin text checker, using the site config values", () => {
		const Provider = bareunAdmin.Provider;
		expect(Provider).toBeDefined();
		if (!Provider) return;
		render(
			<SiteProvider site={testSite}>
				<Provider>
					<Checkers />
				</Provider>
			</SiteProvider>,
		);
		expect(screen.getByText("bareun")).toBeTruthy();
	});

	it("the plugin definition fills in defaults and rejects invalid values", () => {
		const plugin = bareun();
		expect(plugin.name).toBe("text-check-bareun");
		expect(typeof plugin.server).toBe("function");
		expect(typeof plugin.admin).toBe("function");
		expect(() => bareun({ apiKeyEnv: "bad key" })).toThrow();
		expect(() => bareun({ limits: { maxChars: 0 } })).toThrow();
	});
});
