import { AiManager } from "./ai-manager.js";
import { AiSlotProvider } from "./ai-slot-provider.js";
import { aiAdminEvents } from "./auto-image-text.js";
import { aiComponents } from "./provider.js";
/**
 * Admin-screen side of the AI plugin. The admin screen reads the site config's `ai()` and loads it.
 * In custom screens, call an action with `useAiAction("name")` or `<AiButton action="name" />`; `aiClient<typeof config>()` gives both typed by the site config.
 */
// The slot actions come from a query the AI screens share, so they need the plugin's own provider.
export default defineAdminPlugin({
    pages: { ai: AiManager },
    components: aiComponents,
    Provider: AiSlotProvider,
    on: aiAdminEvents,
});
export { AiButton } from "./ai-button.js";
export { aiClient } from "./ai-client.js";
export { useAiAction } from "./use-ai-action.js";
import { defineAdminPlugin } from "@monti-cms/admin";
