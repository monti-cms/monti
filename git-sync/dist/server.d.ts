import type { CmsServerPlugin } from "@monti-cms/core";
/** Server side of the git-sync plugin. Loaded by the core API handler, the event outbox and the `monti` commands. Not included in the browser bundle. */
declare const gitSyncServer: CmsServerPlugin;
export default gitSyncServer;
