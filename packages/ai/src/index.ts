/**
 * AI plugin authoring API. The entry point imported by the site config file (`cms.config.ts`). Both server and browser read it, so
 * it must not contain secrets or the AI SDK.
 */

export {
	type AiActionDefinition,
	type AiActionFactory,
	type AiActionSource,
	type AiAttach,
	type AiChoices,
	type AiConfig,
	type AiContentLookup,
	type AiContribution,
	type AiInputSpec,
	type AiSharedText,
	type AiSiteView,
	type AiValidator,
	type AiValidatorContext,
	type AiValidatorResult,
	aiAction,
	aiInput,
	defineValidator,
} from "./action";
export { aiPlugin } from "./plugin";
export {
	type AiFieldTarget,
	aiPresets,
	DEFAULT_AI_ACTIONS,
	fieldAttachOf,
	fieldTargets,
	KEBAB_PATTERN,
	smallestMax,
	translatableAttributes,
} from "./presets";
export { resolveAiActions, resolveAiConfig } from "./resolve";
export { type RegexRunsRule, regexRuns, sameStructure, uniqueSlug } from "./validators";
