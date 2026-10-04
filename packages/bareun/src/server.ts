import type { CmsServerPlugin } from "@monti-cms/core";
import { readBareunOptions } from "./config";
import { BAREUN_ROUTE } from "./options";
import { bareunRoute } from "./route";

export { type BareunRequestOptions, checkWithBareun, requestBareun } from "./api";
export { bareunRoute } from "./route";

/** Server side of the Bareun checker. The core API handler loads it through the route table. Not included in the browser bundle. */
const bareunServer: CmsServerPlugin = {
	routes: [{ pattern: BAREUN_ROUTE, module: bareunRoute(readBareunOptions()) }],
};

export default bareunServer;
