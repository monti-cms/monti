import { commands } from "./commands.js";
import { onContentEvent } from "./events.js";
import { tokenKeyOf } from "./keys.js";
import { GIT_SYNC_PLUGIN_NAME, GIT_SYNC_TOKEN_SLOT } from "./options.js";
import { resumeAfterToken } from "./outbound.js";
import * as routes from "./routes.js";
import { syncContextFor } from "./sync.js";
/** Server side of the git-sync plugin. Loaded by the core API handler, the event outbox and the `monti` commands. Not included in the browser bundle. */
const gitSyncServer = {
    routes: [
        { pattern: "v1/git-sync/status", module: routes.status },
        { pattern: "v1/git-sync/pull", module: routes.pull },
        { pattern: "v1/git-sync/flush", module: routes.flush },
        { pattern: "v1/git-sync/conflicts", module: routes.conflicts },
        { pattern: "v1/git-sync/conflicts/resolve", module: routes.resolve },
        // GitHub calls this without a login; the route checks the webhook signature itself.
        { pattern: "v1/git-sync/webhook", module: routes.webhook, public: true },
    ],
    // Delivered through the event outbox: a failed push is retried, not lost.
    hooks: { afterCommit: (event, cms) => onContentEvent(syncContextFor(cms), event) },
    commands,
    // `features["git-sync"].ready` of the admin meta API: is a token saved?
    features: async (cms) => ({
        ready: await tokenKeyOf(cms).then((key) => Boolean(key?.readable), () => false),
    }),
};
/** Called once a key was assigned to the token slot (`onChange` of the slot): what waited for a token goes out now. */
export const onTokenChanged = async (cms) => {
    if (await cms.apiKeys.slot(GIT_SYNC_PLUGIN_NAME, GIT_SYNC_TOKEN_SLOT).read())
        await resumeAfterToken(syncContextFor(cms));
};
export default gitSyncServer;
