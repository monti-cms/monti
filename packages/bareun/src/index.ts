import { createActiveTranslator, definePlugin } from "@monti-cms/core";
import { bareunMessages } from "./messages";
import { BAREUN_PAGE_PATH, BAREUN_PLUGIN_NAME, type BareunOptions, resolveBareunOptions } from "./options";

export { type BareunIssueSegment, type BareunResponse, type BareunRevisedBlock, bareunIssues } from "./mapping";
export { BAREUN_PLUGIN_NAME, type BareunOptions, type ResolvedBareunOptions } from "./options";

/**
 * Bareun spell and sentence checker. Add it to the site config `plugins` and the editor gets a "Spell check" button,
 * and the server route (`/api/monti/v1/text-check/bareun`) calls Bareun with the API key. The key is chosen on the plugin's Spell check page and kept in the central API key store.
 *
 * ```ts
 * plugins: [bareun()]
 * ```
 */
export const bareun = (options?: BareunOptions) =>
	definePlugin({
		name: BAREUN_PLUGIN_NAME,
		options: resolveBareunOptions(options),
		nav: [{ path: BAREUN_PAGE_PATH, label: createActiveTranslator(bareunMessages)("nav.label"), icon: "spell-check" }],
		// In the browser bundle, `./server` is swapped for an empty entry point (`server.browser.ts`) (package.json `exports`).
		server: () => import("@monti-cms/bareun/server"),
		admin: () => import("@monti-cms/bareun/admin"),
	});
