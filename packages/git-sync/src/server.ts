import type { CmsServerPlugin } from "@monti-cms/core";
import type { Cms } from "@monti-cms/core/server";
import { commands } from "./commands";
import { onContentEvent } from "./events";
import { tokenKeyOf } from "./keys";
import { GIT_SYNC_PLUGIN_NAME, GIT_SYNC_TOKEN_SLOT } from "./options";
import { resumeAfterToken } from "./outbound";
import * as routes from "./routes";
import { syncContextFor } from "./sync";

/** Server side of the git-sync plugin. Loaded by the core API handler, the event outbox and the `monti` commands. Not included in the browser bundle. */
const gitSyncServer: CmsServerPlugin = {
	routes: [
		{ pattern: "v1/git-sync/status", module: routes.status },
		{ pattern: "v1/git-sync/pull", module: routes.pull },
		{ pattern: "v1/git-sync/flush", module: routes.flush },
		{ pattern: "v1/git-sync/conflicts", module: routes.conflicts },
		{ pattern: "v1/git-sync/conflicts/resolve", module: routes.resolve },
		// GitHub calls this without a login; the route checks the webhook signature itself.
		{ pattern: "v1/git-sync/webhook", module: routes.webhook, access: "signed" },
	],
	// Delivered through the event outbox: a failed push is retried, not lost.
	hooks: { afterCommit: (event, cms) => onContentEvent(syncContextFor(cms), event) },
	commands,
	// `features["git-sync"].ready` of the admin meta API: is a token saved?
	features: async (cms) => ({
		ready: await tokenKeyOf(cms).then(
			(key) => Boolean(key?.readable),
			() => false,
		),
	}),
};

/** Called once a key was assigned to the token slot (`onChange` of the slot): what waited for a token goes out now. */
export const onTokenChanged = async (cms: Cms): Promise<void> => {
	if (await cms.apiKeys.slot(GIT_SYNC_PLUGIN_NAME, GIT_SYNC_TOKEN_SLOT).read())
		await resumeAfterToken(syncContextFor(cms));
};

export default gitSyncServer;
