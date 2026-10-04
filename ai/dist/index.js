/**
 * AI plugin authoring API. The entry point imported by the site config file (`cms.config.ts`). Both server and browser read it, so
 * it must not contain secrets or the AI SDK.
 */
export { aiAction, aiInput, defineValidator, } from "./action.js";
export { aiPlugin } from "./plugin.js";
export { aiPresets, DEFAULT_AI_ACTIONS, fieldAttachOf, fieldTargets, KEBAB_PATTERN, smallestMax, translatableAttributes, } from "./presets.js";
export { resolveAiActions, resolveAiConfig } from "./resolve.js";
export { regexRuns, sameStructure, uniqueSlug } from "./validators.js";
