import type { PluginId } from "@monti-cms/core";
import type { AiConfig } from "./action";

/** The name under which the AI plugin is found in the site config's `plugins`. */
export const AI_PLUGIN_NAME = "ai";

/** The AI plugin with the type of its options (`site.pluginOptions(AI_PLUGIN)`). */
export const AI_PLUGIN: PluginId<typeof AI_PLUGIN_NAME, AiConfig> = { name: AI_PLUGIN_NAME };
