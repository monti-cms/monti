# Send a Slack message when a post is published

Goal: when a post is published, post one message to a Slack channel (or any endpoint that takes `{ "text": "…" }`) with its title and address. If Slack is down the publish still works, and the message arrives later, once.

The snippet below is a sketch to adapt, not tested code.

## What you need to know

1. **`afterCommit` is a subscriber after the save, not a check before it.** It is notified once the change is committed and never blocks or undoes a write. The checks before the save (`transform`, `validate`, `validatePublish`) are the other kind ("Hook contract" and "Event delivery" in the [core README](../../packages/core/README.md)).
2. **Each subscriber is an entry `{ name, run }` of the `afterCommit` list**, delivered from an outbox on its own: at least once, in order per entry, retried with a growing delay when it throws. Its deliveries are kept under `<owner>:<name>` (`plugin:slack-on-publish:post` here), so keep the name. `run` must be idempotent: the same event can arrive twice.
3. **`event.once(run)` is the idempotency helper.** It runs `run` one time per event and subscriber: a repeat skips it, and a `run` that throws is not marked, so the retry runs it again. No storage code of your own.
4. **`run` gets its scope last**: `run(event, { cms })` in the config's `hooks`, `run(event, { cms, plugin })` in a plugin's, so it can read the site, the entry and its own storage (`plugin.storage`).
5. **`event.read()`** returns the committed entry now (`null` if it was deleted): the event itself carries ids, the kind and slugs, never the body.
6. **A plugin's `server` can be inline or a lazy loader.** This one calls out over the network and has its own settings, so it uses a loader (see "Inline or `server`" below).

## A sketch

```ts
import { definePlugin } from "@monti-cms/core";

export const slackOnPublish = (options: { webhookUrl?: string; collections?: readonly string[] } = {}) =>
	definePlugin({
		name: "slack-on-publish",
		// Only JSON that the browser may read goes in `options`: the webhook URL is a secret and stays in this closure.
		options: {},
		server: async () => ({
			default: {
				hooks: {
					afterCommit: [
						{
							// Its deliveries are kept under `plugin:slack-on-publish:post`. A throw is retried later and never undoes the publish.
							name: "post",
							run: async (event, { cms }) => {
								if (event.kind !== "published" || !(options.collections ?? ["post"]).includes(event.collection)) return;

								// Delivery is at least once. `once` runs the work for this event one time: a repeat skips it,
								// and a throw inside leaves it unmarked, so the retry sends the message.
								await event.once(async () => {
									const entry = await event.read();
									if (!entry?.published) return; // deleted or unpublished again since

									const webhookUrl = options.webhookUrl ?? process.env.SLACK_WEBHOOK_URL;
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
		}),
	});
```

In `monti.config.ts`:

```ts
plugins: [slackOnPublish()], // reads SLACK_WEBHOOK_URL, or slackOnPublish({ webhookUrl })
```

## How it behaves

- `kind` is `published` for a publish (a draft save is `saved`), so a draft announces nothing.
- The message is sent inside `event.once`, and the event is marked done when the function returns. If Slack answers `500` the function throws, nothing is marked, the publish stays, and the delivery is retried (`monti events:retry`, the next write in the process, or a cron call to `/api/monti/v1/events/retry`).
- `once` is "at most once unless the process dies between the end of the function and the mark". A crash in that gap sends the message twice, which is what at-least-once delivery means. The marks are kept as long as the events are (90 days).
- The webhook URL is a secret, so it stays in the plugin's closure and never goes in `options` (the browser reads `options`).
- To test it, build a server with `testServer()` from `@monti-cms/core/testing`, publish a post and give the plugin a fake `fetch`.

## Inline or `server`

A plugin's write hooks (`transform`, `validate`, `validatePublish`, `afterCommit`) are the `hooks` of its `server`, which comes in two forms:

- **Inline**: `definePlugin({ name: "audit", server: { hooks: { afterCommit: [{ name: "log", run }] } } })`. No module file. An inline server loads with every server start (the CLI, edge and cold starts included), so use this when they are light. They may use secrets through `plugin.secrets` or the environment; `monti.config.ts` is server-only and never reaches the browser. The [slug rule](slug-rule.md#as-a-plugin) is the example.
- **As a loader**: `server: async () => ({ default: { hooks } })`, or `server: () => import("./server")`. Loaded when it is needed, and the place for heavy code (an SDK, a database client) and for a plugin that has routes, migrations or commands. This recipe uses it because it is a network client.

The hooks have one place, `server`; there is no second one.
