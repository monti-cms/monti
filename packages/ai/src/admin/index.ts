import { agentPanel } from "./agent-panel";
import { AiManager } from "./ai-manager";
import { AiSlotProvider } from "./ai-slot-provider";
import { aiAdminEvents } from "./auto-image-text";
import { aiComponents } from "./provider";

/**
 * Admin-screen side of the AI plugin. The admin screen reads the site config's `ai()` and loads it.
 * In custom screens, call an action with `useAiAction("name")` or `<AiButton action="name" />`; `aiClient<typeof config>()` gives both typed by the site config.
 */
// The slot actions come from a query the AI screens share, so they need the plugin's own provider.
export default defineAdminPlugin({
	pages: { ai: AiManager },
	panel: agentPanel,
	components: aiComponents,
	Provider: AiSlotProvider,
	on: aiAdminEvents,
});

export { AiButton, type AiButtonProps } from "./ai-button";
export { type AiClient, aiClient } from "./ai-client";
export { type UseAiAction, useAiAction } from "./use-ai-action";

import { defineAdminPlugin } from "@monti-cms/admin";
