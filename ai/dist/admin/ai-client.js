import { AiButton } from "./ai-button.js";
import { useAiAction } from "./use-ai-action.js";
/**
 * `useAiAction` and `AiButton` typed by the site config: an unknown action name is a type error, and an action's input and result come from its definition. Only the types
 * differ, so call it once in the module of the screen, with the type of the config file.
 *
 * ```tsx
 * import type config from "./cms.config";
 * export const { useAiAction, AiButton } = aiClient<typeof config>();
 * ```
 */
export const aiClient = () => ({ useAiAction, AiButton });
