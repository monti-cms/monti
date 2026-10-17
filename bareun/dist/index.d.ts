import { type BareunOptions } from "./options.js";
export { type BareunIssueSegment, type BareunResponse, type BareunRevisedBlock, bareunIssues } from "./mapping.js";
export { BAREUN_PLUGIN_NAME, type BareunOptions, type ResolvedBareunOptions } from "./options.js";
/**
 * Bareun spell and sentence checker. Add it to the site config `plugins` and the editor gets a "Spell check" button,
 * and the server route (`/api/monti/v1/text-check/bareun`) calls Bareun with the API key. The key is assigned under Tools > API keys (the plugin declares one key slot).
 *
 * ```ts
 * plugins: [bareun()]
 * ```
 */
export declare const bareun: (options?: BareunOptions) => import("@monti-cms/core").Plugin<"text-check-bareun", import("./options.js").ResolvedBareunOptions, readonly import("@monti-cms/core").BlockDefinition[]> & {
    readonly contributes?: import("@monti-cms/core").PluginContributions | undefined;
};
