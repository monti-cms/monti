import type { CmsServerPlugin } from "@monti-cms/core";
export { type BareunRequestOptions, checkWithBareun, requestBareun } from "./api.js";
export { bareunRoute } from "./route.js";
/** Server side of the Bareun checker. The core API handler loads it through the route table. Not included in the browser bundle. */
declare const bareunServer: CmsServerPlugin;
export default bareunServer;
