import { getPluginOptions } from "@monti-cms/core/client";
import { BAREUN_PLUGIN_NAME, type ResolvedBareunOptions, resolveBareunOptions } from "./options";

/** Settings of the Bareun checker registered in the site config. Read by both the server route and the admin UI. */
export function readBareunOptions(): ResolvedBareunOptions {
	return getPluginOptions<ResolvedBareunOptions>(BAREUN_PLUGIN_NAME) ?? resolveBareunOptions();
}
