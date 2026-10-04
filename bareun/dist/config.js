import { getPluginOptions } from "@monti-cms/core/client";
import { BAREUN_PLUGIN_NAME, resolveBareunOptions } from "./options.js";
/** Settings of the Bareun checker registered in the site config. Read by both the server route and the admin UI. */
export function readBareunOptions() {
    return getPluginOptions(BAREUN_PLUGIN_NAME) ?? resolveBareunOptions();
}
