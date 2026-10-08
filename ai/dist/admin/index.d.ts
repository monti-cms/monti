/**
 * Admin-screen side of the AI plugin. The admin screen reads the site config's `aiPlugin()` and loads it.
 * In custom screens, call an action with `useAiAction("name")` or `<AiButton action="name" />`; `aiClient<typeof config>()` gives both typed by the site config.
 */
declare const _default: import("@monti-cms/admin/plugins").CmsAdminPlugin;
export default _default;
export { AiButton, type AiButtonProps } from "./ai-button.js";
export { type AiClient, aiClient } from "./ai-client.js";
export { type UseAiAction, useAiAction } from "./use-ai-action.js";
