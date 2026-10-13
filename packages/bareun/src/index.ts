import { createActiveTranslator, definePlugin } from "@monti-cms/core";
import { bareunMessages } from "./messages";
import { BAREUN_KEY_SLOT, BAREUN_PLUGIN_NAME, type BareunOptions, resolveBareunOptions } from "./options";

export { type BareunIssueSegment, type BareunResponse, type BareunRevisedBlock, bareunIssues } from "./mapping";
export { BAREUN_PLUGIN_NAME, type BareunOptions, type ResolvedBareunOptions } from "./options";

const t = createActiveTranslator(bareunMessages);

/**
 * Bareun spell and sentence checker. Add it to the site config `plugins` and the editor gets a "Spell check" button,
 * and the server route (`/api/monti/v1/text-check/bareun`) calls Bareun with the API key. The key is assigned under Tools > API keys (the plugin declares one key slot).
 *
 * ```ts
 * plugins: [bareun()]
 * ```
 */
export const bareun = (options?: BareunOptions) =>
	definePlugin({
		name: BAREUN_PLUGIN_NAME,
		options: resolveBareunOptions(options),
		keySlots: [
			{
				id: BAREUN_KEY_SLOT,
				service: "Bareun",
				// Worked out with the site of the instance each time, so it follows the admin language.
				label: (site) => site.createTranslator(bareunMessages)("keyLabel"),
			},
		],
		// In the browser bundle, `./server` is swapped for an empty entry point (`server.browser.ts`) (package.json `exports`).
		server: () => import("@monti-cms/bareun/server"),
		admin: () => import("@monti-cms/bareun/admin"),
	});
