import { defineServerPlugin, type KeySlotChange, type PluginScope } from "@monti-cms/core/server";
import { commands } from "./commands";
import { onContentEvent } from "./events";
import { tokenKeyOf } from "./keys";
import { GIT_SYNC_TOKEN_SLOT } from "./options";
import { resumeAfterToken } from "./outbound";
import * as routes from "./routes";
import { syncContextFor } from "./sync";

/** Server side of the git-sync plugin. Loaded by the core API handler, the event outbox and the `monti` commands. Not included in the browser bundle. */
export default defineServerPlugin({
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
	// Its deliveries are kept under `plugin:git-sync:sync`; keep the name, or the changes that are still waiting start over.
	on: {
		entry: { changed: [{ name: "sync", run: (event, { cms }) => onContentEvent(syncContextFor(cms), event) }] },
		// A token was chosen: what waited for one goes out now.
		keySlot: { changed: [onTokenChanged] },
	},
	commands,
	// `features["git-sync"].ready` of the admin meta API: is a token saved?
	features: async ({ cms }) => ({
		ready: await tokenKeyOf(cms).then(
			(key) => Boolean(key?.readable),
			() => false,
		),
	}),
});

/** `keySlot.changed`: once a key was assigned to the token slot, what waited for a token goes out now. */
async function onTokenChanged({ slot }: KeySlotChange, { cms, plugin }: PluginScope): Promise<void> {
	if (slot !== GIT_SYNC_TOKEN_SLOT) return;
	if (await plugin.key(GIT_SYNC_TOKEN_SLOT).read()) await resumeAfterToken(syncContextFor(cms));
}
