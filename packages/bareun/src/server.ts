import type { CmsServerPlugin } from "@monti-cms/core";
import { BAREUN_ROUTE, BAREUN_SETTINGS_ROUTE } from "./options";
import { bareunRoute } from "./route";
import { adoptEnvKey } from "./settings";
import { settingsRoute } from "./settings-route";

export { type BareunRequestOptions, checkWithBareun, requestBareun } from "./api";
export { bareunRoute } from "./route";

/** Server side of the Bareun checker. The core API handler loads it through the route table. Not included in the browser bundle. */
const bareunServer: CmsServerPlugin = {
	routes: [
		{ pattern: BAREUN_ROUTE, module: bareunRoute() },
		{ pattern: BAREUN_SETTINGS_ROUTE, module: settingsRoute },
	],
	// Moves the key of the old `BAREUN_API_KEY` environment variable into the API key store.
	migrate: adoptEnvKey,
};

export default bareunServer;
