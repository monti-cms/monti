import { defineAdminPlugin } from "@monti-cms/admin/plugins";
import { AiManager } from "./ai-manager";
import { AiAdminProvider } from "./provider";

/**
 * Admin-screen side of the AI plugin. The admin screen reads the site config's `aiPlugin()` and loads it.
 * In custom screens, call an action with `useAiAction("name")` or `<AiButton action="name" />`; `aiClient<typeof config>()` gives both typed by the site config.
 */
export default defineAdminPlugin({ pages: { ai: AiManager }, Provider: AiAdminProvider });

export { AiButton, type AiButtonProps } from "./ai-button";
export { type AiClient, aiClient } from "./ai-client";
export { type UseAiAction, useAiAction } from "./use-ai-action";
