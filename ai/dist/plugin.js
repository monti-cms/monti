import { definePlugin } from "@monti-cms/core";
import { validateAiConfig } from "./action.js";
import { AI_PLUGIN_NAME } from "./plugin-name.js";
import { resolveAiConfig } from "./resolve.js";
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
export function aiPlugin(config = {}) {
    return definePlugin({
        name: AI_PLUGIN_NAME,
        options: config,
        nav: [{ path: "ai", label: "AI", icon: "sparkles" }],
        validate: ({ collections, blocks, blockDefinitions, locales, plugins }) => validateAiConfig(resolveAiConfig(config, { collections, blocks: blockDefinitions, locales }, plugins), collections, blocks),
        // In the browser bundle `./server` is replaced by an empty entry point (`server.browser.ts`) (package.json `exports`).
        server: () => import("@monti-cms/ai/server"),
        admin: () => import("@monti-cms/ai/admin"),
    });
}
