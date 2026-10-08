import type { AnyCmsConfig } from "@monti-cms/core/client";
import type { ReactNode } from "react";
import type { AiActionKey } from "../registry.js";
import { type AiButtonProps } from "./ai-button.js";
import { type UseAiAction } from "./use-ai-action.js";
/** The hook and the button with the action names, inputs and results of one site config. */
export interface AiClient<Config extends AnyCmsConfig> {
    useAiAction<K extends AiActionKey<Config>>(key: K, enabled?: boolean): UseAiAction<K, Config>;
    AiButton<K extends AiActionKey<Config>>(props: AiButtonProps<K, Config>): ReactNode;
}
/**
 * `useAiAction` and `AiButton` typed by the site config: an unknown action name is a type error, and an action's input and result come from its definition. Only the types
 * differ, so call it once in the module of the screen, with the type of the config file.
 *
 * ```tsx
 * import type config from "./cms.config";
 * export const { useAiAction, AiButton } = aiClient<typeof config>();
 * ```
 */
export declare const aiClient: <Config extends AnyCmsConfig>() => AiClient<Config>;
