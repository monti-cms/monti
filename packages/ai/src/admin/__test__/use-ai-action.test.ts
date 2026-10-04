// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import type { UseAiAction } from "../use-ai-action";

/** Checks the action names, inputs and result types derived from the site config (`src/cms.config.ts`). Nothing is executed. */
describe("useAiAction types", () => {
	it("checks name, input and result from the config", () => {
		const check = (summary: UseAiAction<"summary">, translate: UseAiAction<"translate">) => {
			void summary.run({ title: "제목", body: "본문" }).then((result) => {
				const text: string = result.text;
				// @ts-expect-error summary returns a single text (no candidate list)
				void result.items;
				return text;
			});
			// @ts-expect-error input not in the definition
			void summary.run({ tittle: "오타" });
			// @ts-expect-error translation requires the source and languages
			void translate.run({ block: "본문" });
			void translate.runMany([{ block: "본문", from: "ko", to: "en" }]);
		};
		// @ts-expect-error action name not in the config
		const unknown: UseAiAction<"sumary"> | undefined = undefined;
		expect([typeof check, unknown]).toEqual(["function", undefined]);
	});
});
