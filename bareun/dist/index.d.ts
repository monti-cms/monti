import { type BareunOptions } from "./options.js";
export { type BareunIssueSegment, type BareunResponse, type BareunRevisedBlock, bareunIssues } from "./mapping.js";
export { BAREUN_PLUGIN_NAME, type BareunOptions, type ResolvedBareunOptions } from "./options.js";
/**
 * Bareun spell and sentence checker. Add it to the site config `plugins` and the editor gets a "Spell check" button,
 * and the server route (`/api/cms/v1/text-check/bareun`) calls Bareun with the API key. The key lives in a server environment variable (default `BAREUN_API_KEY`).
 *
 * ```ts
 * plugins: [bareun()]
 * ```
 */
export declare const bareun: (options?: BareunOptions) => import("@monti-cms/core").CmsPlugin<"text-check-bareun", import("./options.js").ResolvedBareunOptions> & {
    readonly contributes?: Readonly<Record<string, unknown>> | undefined;
};
