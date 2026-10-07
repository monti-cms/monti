// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import type config from "../../../test/cms.config";
import type { AiActionInputOf, AiActionKey } from "../../registry";
import { aiClient } from "../ai-client";
import type { UseAiAction } from "../use-ai-action";

/** Checks the action names, inputs and result types derived from the site config type (`test/cms.config.ts`). Nothing is executed. */
describe("useAiAction types", () => {
	it("checks name, input and result from the config type", () => {
		const check = (
			summary: UseAiAction<"summary", typeof config>,
			translate: UseAiAction<"translate", typeof config>,
		) => {
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
		const unknown: UseAiAction<"sumary", typeof config> | undefined = undefined;
		expect([typeof check, unknown]).toEqual(["function", undefined]);
	});

	it("`aiClient<typeof config>()` gives the hook and the button the same names and inputs", () => {
		const client = aiClient<typeof config>();
		const check = () => {
			const summary = client.useAiAction("summary");
			void summary.run({ title: "제목", body: "본문" });
			// @ts-expect-error action name not in the config
			client.useAiAction("sumary");
			const key: AiActionKey<typeof config> = "translate";
			const input: AiActionInputOf<"translate", typeof config> = { block: "본문", from: "ko", to: "en" };
			return [key, input];
		};
		expect(typeof check).toBe("function");
	});

	it("without a config type any name is accepted and an input is any input", () => {
		const check = (anything: UseAiAction<"anything">) => {
			void anything.run({ whatever: "값" });
			const key: AiActionKey = "name-from-a-site-we-know-nothing-about";
			return key;
		};
		expect(typeof check).toBe("function");
	});
});
