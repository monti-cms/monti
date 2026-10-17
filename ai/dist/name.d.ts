import type { PluginId } from "@monti-cms/core";
import type { AiConfig } from "./action.js";
/** The name under which the AI plugin is found in the site config's `plugins`. */
export declare const AI_PLUGIN_NAME = "ai";
/** The AI plugin with the type of its options (`site.pluginOptions(AI_PLUGIN)`). */
export declare const AI_PLUGIN: PluginId<typeof AI_PLUGIN_NAME, AiConfig>;
