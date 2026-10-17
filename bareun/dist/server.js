import { defineServerPlugin } from "@monti-cms/core/server";
import { BAREUN_ROUTE } from "./options.js";
import { bareunRoute } from "./route.js";
export { checkWithBareun, requestBareun } from "./api.js";
export { bareunRoute } from "./route.js";
/** Server side of the Bareun checker. The core API handler loads it through the route table. Not included in the browser bundle. */
export default defineServerPlugin({
    routes: [{ pattern: BAREUN_ROUTE, module: bareunRoute() }],
});
