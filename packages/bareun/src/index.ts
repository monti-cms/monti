import { definePlugin } from "@monti-cms/core";
import { BAREUN_PLUGIN_NAME, type BareunOptions, resolveBareunOptions } from "./options";

export { type BareunIssueSegment, type BareunResponse, type BareunRevisedBlock, bareunIssues } from "./mapping";
export { BAREUN_PLUGIN_NAME, type BareunOptions, type ResolvedBareunOptions } from "./options";

/**
 * Bareun spell and sentence checker. Add it to the site config `plugins` and the editor gets a "Spell check" button,
 * and the server route (`/api/cms/v1/text-check/bareun`) calls Bareun with the API key. The key lives in a server environment variable (default `BAREUN_API_KEY`).
 *
 * ```ts
 * plugins: [bareun()]
 * ```
 */
export const bareun = (options?: BareunOptions) =>
	definePlugin({
		name: BAREUN_PLUGIN_NAME,
		options: resolveBareunOptions(options),
		// In the browser bundle, `./server` is swapped for an empty entry point (`server.browser.ts`) (package.json `exports`).
		server: () => import("@monti-cms/bareun/server"),
		admin: () => import("@monti-cms/bareun/admin"),
	});
