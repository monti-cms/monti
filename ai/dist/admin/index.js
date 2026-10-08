import { defineAdminPlugin } from "@monti-cms/admin/plugins";
import { AiManager } from "./ai-manager.js";
import { AiAdminProvider } from "./provider.js";
/**
 * Admin-screen side of the AI plugin. The admin screen reads the site config's `aiPlugin()` and loads it.
 * In custom screens, call an action with `useAiAction("name")` or `<AiButton action="name" />`; `aiClient<typeof config>()` gives both typed by the site config.
 */
export default defineAdminPlugin({ pages: { ai: AiManager }, Provider: AiAdminProvider });
export { AiButton } from "./ai-button.js";
export { aiClient } from "./ai-client.js";
export { useAiAction } from "./use-ai-action.js";
