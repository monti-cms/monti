import { createActiveTranslator, definePlugin } from "@monti-cms/core";
import { type AiConfig, validateAiConfig } from "./action";
import { AI_PLUGIN_NAME } from "./plugin-name";
import { resolveAiConfig } from "./resolve";

/**
 * AI plugin. List it once in `plugins` of the site config (`cms.config.ts`) to get AI actions (calling by name, buttons next to fields,
 * translation), the admin AI screen, the AI API (`/api/cms/v1/ai/*`), and the AI tables.
 *
 * Default actions (`aiPresets`) turn on automatically wherever they can attach, and so do actions added by other plugins (block extension, SEO extension, etc.).
 * List only what you want to change or turn off in `actions`.
 *
 * ```ts
 * plugins: [aiPlugin({ siteDescription: "A personal tech blog", actions: { draft: false } })]
 * ```
 */
export function aiPlugin<const Config extends AiConfig>(config: Config = {} as Config) {
	return definePlugin({
		name: AI_PLUGIN_NAME,
		options: config,
		nav: [{ path: "ai", label: "AI", icon: "sparkles" }],
		validate: ({ collections, blocks, blockDefinitions, locales, plugins }) =>
			validateAiConfig(
				resolveAiConfig(
					config,
					// No site exists while the config is being defined: the labels the factories write are not read here, so the active (English) translator is enough.
					{ collections, blocks: blockDefinitions, locales, createTranslator: createActiveTranslator },
					plugins,
				),
				collections,
				blocks,
			),
		// In the browser bundle `./server` is replaced by an empty entry point (`server.browser.ts`) (package.json `exports`).
		server: () => import("@monti-cms/ai/server"),
		admin: () => import("@monti-cms/ai/admin"),
	});
}
