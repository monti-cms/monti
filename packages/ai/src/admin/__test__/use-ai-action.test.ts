// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import type { UseAiAction } from "../use-ai-action";

/** 사이트 설정(`src/cms.config.ts`)에서 나온 기능 이름·입력·결과 타입을 확인한다. 실행하지 않는다. */
describe("useAiAction 타입", () => {
	it("이름·입력·결과를 설정에서 확인한다", () => {
		const check = (summary: UseAiAction<"summary">, translate: UseAiAction<"translate">) => {
			void summary.run({ title: "제목", body: "본문" }).then((result) => {
				const text: string = result.text;
				// @ts-expect-error 요약은 글 하나를 돌려준다(후보 목록이 없다)
				void result.items;
				return text;
			});
			// @ts-expect-error 정의에 없는 입력
			void summary.run({ tittle: "오타" });
			// @ts-expect-error 번역은 원문·언어가 꼭 필요하다
			void translate.run({ block: "본문" });
			void translate.runMany([{ block: "본문", from: "ko", to: "en" }]);
		};
		// @ts-expect-error 설정에 없는 기능 이름
		const unknown: UseAiAction<"sumary"> | undefined = undefined;
		expect([typeof check, unknown]).toEqual(["function", undefined]);
	});
});
