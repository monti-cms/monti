import type { CmsServerPlugin } from "@monti-cms/core";
/** Server side of the AI plugin. Loaded by the core API handler and `monti migrate`. Not included in the browser bundle. */
declare const aiServer: CmsServerPlugin;
export default aiServer;
