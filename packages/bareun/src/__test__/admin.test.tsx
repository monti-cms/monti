import { useCmsAdminComponents } from "@monti-cms/admin";
import { createTranslator } from "@monti-cms/core/client";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import bareunAdmin from "../admin";
import { bareun } from "../index";
import { bareunMessages } from "../messages";
import { bareunChecker } from "../provider";

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
			<Provider>
				<Checkers />
			</Provider>,
		);
		expect(screen.getByText("bareun")).toBeTruthy();
		// The name from the test config (`test/cms.config.ts`). Auto check is off by default.
		expect([bareunChecker.id, bareunChecker.label, bareunChecker.locales?.join(","), bareunChecker.auto]).toEqual([
			"bareun",
			"바른 검사",
			"ko",
			false,
		]);
	});

	it("the plugin definition fills in defaults and rejects invalid values", () => {
		const plugin = bareun();
		expect(plugin.name).toBe("text-check-bareun");
		expect(plugin.options).toEqual({
			apiKeyEnv: "BAREUN_API_KEY",
			baseUrl: "https://api.bareun.ai",
			label: createTranslator(bareunMessages)("label"),
			auto: false,
			customDictNames: [],
			limits: { maxSegments: 100, maxChars: 10_000 },
		});
		expect(typeof plugin.server).toBe("function");
		expect(typeof plugin.admin).toBe("function");
		expect(() => bareun({ apiKeyEnv: "bad key" })).toThrow();
		expect(() => bareun({ limits: { maxChars: 0 } })).toThrow();
	});
});
