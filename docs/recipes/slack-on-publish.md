# Send a Slack message when a post is published

Goal: when a post is published, post one message to a Slack channel (or any endpoint that takes `{ "text": "…" }`) with its title and address. If Slack is down the publish still works, and the message arrives later, once.

The code below is the recipe's own files in [`src/slack-on-publish/`](src/slack-on-publish/), type checked in CI.

## What you need to know

1. **`entry.published` is a notification after the save, not a check before it.** It is notified once the change is committed and never blocks or undoes a write. The `before…` events (`entry.beforeValidate`, `beforeSave`, `beforePublish`) are the other kind: they run before the save and may change or block it ("Events (`on`)" and "Event delivery" in the [core README](../../packages/core/README.md)). There is one durable event per kind of change (`created`, `saved`, `published`, `archived`, `unarchived`, `trashed`, `restored`, `deleted`) and `entry.changed` for all of them, so this recipe needs no `if (event.kind !== "published")`.
2. **Each subscriber is an entry `{ name, run }` of the `entry.published` list**, delivered from an outbox on its own: at least once, in order per entry, retried with a growing delay when it throws. Its deliveries are kept under `<owner>:<name>` (`plugin:slack-on-publish:post` here), so keep the name. `run` must be idempotent: the same event can arrive twice.
3. **`event.once(run)` is the idempotency helper.** It runs `run` one time per event and subscriber: a repeat skips it, and a `run` that throws is not marked, so the retry runs it again. No storage code of your own.
4. **`run` gets its scope last**: `run(event, { cms })` in the config's `on`, `run(event, { cms, plugin })` in a plugin's, so it can read the site, the entry and its own storage (`plugin.storage`).
5. **`event.read()`** returns the committed entry now (`null` if it was deleted): the event itself carries ids, the kind and slugs, never the body.
6. **A plugin's server side is a module of its own**, loaded on the server only: `server: () => import("./server")`, whose default export is `defineServerPlugin({ on })`. The factory module is what the site config imports, and that can reach the browser bundle, so server code never sits in it (see "Why a module of its own" below).
7. **Options are JSON the browser may read.** The server side reads them typed through the plugin's id (`cms.site.pluginOptions(SLACK_ON_PUBLISH)`). A secret never goes in them: the webhook URL comes from the environment (or from a key slot, `plugin.key(id)`, as the Bareun plugin does).

## The code

The plugin, with its options and its id:

<!-- src/slack-on-publish/index.ts -->
```ts
import { definePlugin, type PluginId } from "@monti-cms/core";

export interface SlackOnPublishOptions {
	/** The collections whose publishes are announced. Default: `["post"]`. */
	readonly collections?: readonly string[];
}

/** The plugin with the type of its options, so the server side reads them typed (`cms.site.pluginOptions(SLACK_ON_PUBLISH)`). */
export const SLACK_ON_PUBLISH: PluginId<"slack-on-publish", SlackOnPublishOptions> = { name: "slack-on-publish" };

export const slackOnPublish = (options: SlackOnPublishOptions = {}) =>
	definePlugin({
		name: SLACK_ON_PUBLISH.name,
		// Only JSON the browser may read goes in `options`: the webhook URL is a secret, so the server side reads it from the environment.
		options,
		server: () => import("./server"),
	});
```

Its server side, the subscriber:

<!-- src/slack-on-publish/server.ts -->
```ts
import { defineServerPlugin } from "@monti-cms/core/server";
import { SLACK_ON_PUBLISH } from "./index";

export default defineServerPlugin({
	on: {
		entry: {
			// Delivered from the outbox on its own: at least once, retried when it throws, and kept under `plugin:slack-on-publish:post`.
			published: [
				{
					name: "post",
					run: async (event, { cms }) => {
						const collections = cms.site.pluginOptions(SLACK_ON_PUBLISH)?.collections ?? ["post"];
						if (!collections.includes(event.collection)) return;

						// Delivery is at least once. `once` runs the work for this event one time: a repeat skips it,
						// and a throw inside leaves it unmarked, so the retry sends the message.
						await event.once(async () => {
							const entry = await event.read();
							if (!entry?.published) return; // deleted or unpublished again since

							const webhookUrl = process.env.SLACK_WEBHOOK_URL;
							if (!webhookUrl) throw new Error("slack-on-publish: set SLACK_WEBHOOK_URL");

							const path = cms.site.contentPath(event.collection, event.publishedSlug);
							const base = cms.site.config.site?.url?.replace(/\/$/, "") ?? "";
							const title = String(entry.published.metadata.title ?? event.publishedSlug);
							const response = await fetch(webhookUrl, {
								method: "POST",
								headers: { "content-type": "application/json" },
								body: JSON.stringify({ text: `Published: ${title}${path ? ` ${base}${path}` : ""}` }),
							});
							if (!response.ok) throw new Error(`slack-on-publish: Slack answered ${response.status}`);
						});
					},
				},
			],
		},
	},
});
```

In `monti.config.ts`: `plugins: [slackOnPublish()]` (it reads `SLACK_WEBHOOK_URL`), or `slackOnPublish({ collections: ["post", "memo"] })`.

## How it behaves

- `kind` is `published` for a publish (a draft save is `saved`), so a draft announces nothing.
- The message is sent inside `event.once`, and the event is marked done when the function returns. If Slack answers `500` the function throws, nothing is marked, the publish stays, and the delivery is retried (`monti events:retry`, the next write in the process, or a cron call to `/api/monti/v1/events/retry`).
- `once` is "at most once unless the process dies between the end of the function and the mark". A crash in that gap sends the message twice, which is what at-least-once delivery means. The marks are kept as long as the events are (90 days).
- The webhook URL is a secret, so it is read from the environment on the server and never goes in `options` (the browser reads `options`).
- To test it, build a server with `testServer()` from `@monti-cms/core/testing`, publish a post and give the plugin a fake `fetch`.

## Why a module of its own

A plugin's reactions (`on`), routes, formats, commands and migrations are all the default export of its server module, and that module is only ever loaded through `server: () => import("./server")`. There is no inline form: the factory (`slackOnPublish()`) lives in a module that the site config imports, and client code that builds a site from a plugin list bundles that module, so anything written in it can reach the browser. Behind the loader, the subscribers are read on the server only.

A plugin published as a package also gives its `./server` export a `browser` condition that points at an empty module ("Publishing a plugin as a package" in the [core README](../../packages/core/README.md)), because a bundler follows the `import()` even though the browser never calls it. A plugin in the site's own folder needs nothing more.
