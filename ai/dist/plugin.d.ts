import { type AiConfig } from "./action.js";
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
export declare function aiPlugin<const Config extends AiConfig>(config?: Config): import("@monti-cms/core").CmsPlugin<"ai", Config> & {
    readonly contributes?: Readonly<Record<string, unknown>> | undefined;
};
