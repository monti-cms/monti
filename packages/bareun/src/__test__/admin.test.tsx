import { AdminComponentsProvider, useAdminComponents } from "@monti-cms/admin";
import { SiteProvider } from "@monti-cms/core/site";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { testSite } from "../../test/site";
import bareunAdmin from "../admin";
import { bareun } from "../index";

afterEach(cleanup);

function Checkers() {
	const { textCheckers = [] } = useAdminComponents();
	return <p>{textCheckers.map((checker) => checker.id).join(",")}</p>;
}

describe("Bareun checker admin side", () => {
	it("declares Bareun as the admin text checker, made from the site config values", () => {
		const { components } = bareunAdmin;
		expect(typeof components).toBe("function");
		if (typeof components !== "function") return;
		render(
			<SiteProvider site={testSite}>
				<AdminComponentsProvider components={components(testSite)}>
					<Checkers />
				</AdminComponentsProvider>
			</SiteProvider>,
		);
		expect(screen.getByText("bareun")).toBeTruthy();
	});

	it("the plugin definition fills in defaults and rejects invalid values", () => {
		const plugin = bareun();
		expect(plugin.name).toBe("text-check-bareun");
		expect(typeof plugin.server).toBe("function");
		expect(typeof plugin.admin).toBe("function");
		expect(plugin.nav ?? []).toEqual([]);
		expect(bareunAdmin.pages ?? {}).toEqual({});
		expect(() => bareun({ baseUrl: "ftp://x" })).toThrow();
		expect(() => bareun({ limits: { maxChars: 0 } })).toThrow();
	});
});
