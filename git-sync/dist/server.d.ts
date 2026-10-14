import type { CmsServerPlugin } from "@monti-cms/core";
import type { Cms } from "@monti-cms/core/plugin/server";
/** Server side of the git-sync plugin. Loaded by the core API handler, the event outbox and the `monti` commands. Not included in the browser bundle. */
declare const gitSyncServer: CmsServerPlugin;
/** Called once a key was assigned to the token slot (`onChange` of the slot): what waited for a token goes out now. */
export declare const onTokenChanged: (cms: Cms) => Promise<void>;
export default gitSyncServer;
