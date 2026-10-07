import type { CmsServerPlugin } from "@monti-cms/core";
import { commands } from "./commands";
import { onContentEvent } from "./events";
import * as routes from "./routes";
import { settingsView } from "./settings";
import { syncContextFor } from "./sync";

/** Server side of the git-sync plugin. Loaded by the core API handler, the event outbox and the `monti` commands. Not included in the browser bundle. */
const gitSyncServer: CmsServerPlugin = {
	routes: [
		{ pattern: "v1/git-sync/status", module: routes.status },
		{ pattern: "v1/git-sync/settings", module: routes.settings },
		{ pattern: "v1/git-sync/pull", module: routes.pull },
		{ pattern: "v1/git-sync/flush", module: routes.flush },
		{ pattern: "v1/git-sync/drafts", module: routes.drafts },
		{ pattern: "v1/git-sync/conflicts", module: routes.conflicts },
		{ pattern: "v1/git-sync/conflicts/resolve", module: routes.resolve },
		// GitHub calls this without a login; the route checks the webhook signature itself.
		{ pattern: "v1/git-sync/webhook", module: routes.webhook, public: true },
	],
	// Delivered through the event outbox: a failed push is retried, not lost.
	afterCommit: (event, cms) => onContentEvent(syncContextFor(cms), event),
	commands,
	// `features["git-sync"].ready` of the admin meta API: is a token saved?
	features: async (cms) => ({
		ready: await settingsView(syncContextFor(cms)).then(
			(view) => view.token.set && view.token.readable,
			() => false,
		),
	}),
};

export default gitSyncServer;
