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

describe("바른 검사기 관리자 쪽", () => {
	it("공급자가 관리자 글 검사기로 바른을 넣고, 검사기는 사이트 설정의 값을 쓴다", () => {
		const Provider = bareunAdmin.Provider;
		expect(Provider).toBeDefined();
		if (!Provider) return;
		render(
			<Provider>
				<Checkers />
			</Provider>,
		);
		expect(screen.getByText("bareun")).toBeTruthy();
		// 테스트 설정(`test/cms.config.ts`)의 이름이다. 자동 검사는 기본으로 끈다.
		expect([bareunChecker.id, bareunChecker.label, bareunChecker.locales?.join(","), bareunChecker.auto]).toEqual([
			"bareun",
			"바른 검사",
			"ko",
			false,
		]);
	});

	it("플러그인 정의는 기본값을 채우고 잘못된 값을 막는다", () => {
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
