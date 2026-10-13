import type { CmsServerPlugin } from "@monti-cms/core";
import { adoptLegacyKey } from "./migrate";
import { BAREUN_ROUTE } from "./options";
import { bareunRoute } from "./route";

export { type BareunRequestOptions, checkWithBareun, requestBareun } from "./api";
export { bareunRoute } from "./route";

/** Server side of the Bareun checker. The core API handler loads it through the route table. Not included in the browser bundle. */
const bareunServer: CmsServerPlugin = {
	routes: [{ pattern: BAREUN_ROUTE, module: bareunRoute() }],
	// Moves the key of the old `BAREUN_API_KEY` variable and of the old settings item into the key slot.
	migrate: adoptLegacyKey,
};

export default bareunServer;
