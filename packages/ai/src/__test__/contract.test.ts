import type * as Contract from "@monti-cms/core/ai-contract";
import { describe, expectTypeOf, it } from "vitest";
import type { AiActionDefinition, AiContribution, AiSiteView, AiValidator } from "../action";
import type {
	AI_APPLIES,
	AI_ENGINES,
	AI_PICKS,
	AI_RESULTS,
	AI_SLOTS,
	AiApply,
	AiCheckInput,
	AiEngine,
	AiPick,
	AiResult,
	AiSlot,
} from "../definition";

/**
 * The contract other plugins write against lives in `@monti-cms/core/ai-contract`. The AI plugin builds its lists and schemas from the same words, so a
 * word added to one side and not the other fails here.
 */
describe("the AI contract of core", () => {
	it("has the same words as the plugin's lists", () => {
		expectTypeOf<(typeof AI_SLOTS)[number]>().toEqualTypeOf<Contract.AiSlot>();
		expectTypeOf<(typeof AI_ENGINES)[number]>().toEqualTypeOf<Contract.AiEngine>();
		expectTypeOf<(typeof AI_PICKS)[number]>().toEqualTypeOf<Contract.AiPick>();
		expectTypeOf<(typeof AI_RESULTS)[number]>().toEqualTypeOf<Contract.AiResult>();
		expectTypeOf<(typeof AI_APPLIES)[number]>().toEqualTypeOf<Contract.AiApply>();
		expectTypeOf<AiSlot>().toEqualTypeOf<Contract.AiSlot>();
		expectTypeOf<AiEngine>().toEqualTypeOf<Contract.AiEngine>();
		expectTypeOf<AiPick>().toEqualTypeOf<Contract.AiPick>();
		expectTypeOf<AiResult>().toEqualTypeOf<Contract.AiResult>();
		expectTypeOf<AiApply>().toEqualTypeOf<Contract.AiApply>();
	});

	it("has the same check input as the check schema", () => {
		expectTypeOf<AiCheckInput>().toExtend<Contract.AiCheckInput>();
		expectTypeOf<Contract.AiCheckInput>().toExtend<AiCheckInput>();
	});

	it("is the definition, the site view, the validator and the contribution the plugin reads", () => {
		expectTypeOf<AiActionDefinition>().toEqualTypeOf<Contract.AiActionDefinition>();
		expectTypeOf<AiSiteView>().toEqualTypeOf<Contract.AiSiteView>();
		expectTypeOf<AiValidator>().toEqualTypeOf<Contract.AiValidator>();
		expectTypeOf<AiContribution>().toEqualTypeOf<Contract.AiContribution>();
	});
});
