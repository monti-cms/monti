# Send a Slack message when a post is published

Goal: when a post is published, post one message to a Slack channel (or any endpoint that takes `{ "text": "…" }`) with its title and address. If Slack is down the publish still works, and the message arrives later, once.

Code: [`examples/recipes/src/slack-on-publish`](../../examples/recipes/src/slack-on-publish). Test: `slack-on-publish.test.ts`.

## What you need to know

1. **`afterCommit` is a notification after the change is committed.** It never blocks or undoes a write ("Event delivery" in the [core README](../../packages/core/README.md)).
2. **It is delivered from an outbox**: at least once, in order per entry, retried with a growing delay when it throws. So the handler must be idempotent: the same `event.eventId` can arrive twice.
3. **A plugin's server side** gets `afterCommit(event, cms)`, with the instance, so it can read its storage and the entry. The config's own `hooks.afterCommit` does not get `cms`.
4. **Plugin storage** (`cms.storage("<plugin>")`) keeps small JSON documents with optimistic versions. It is the place to remember which events were handled.
5. **`event.read()`** returns the committed entry now (`null` if it was deleted): the event itself carries ids, the kind and slugs, never the body.

## The code

<!-- source: examples/recipes/src/slack-on-publish/slack-on-publish.ts -->
```ts
import { definePlugin } from "@monti-cms/core";

export interface SlackOnPublishOptions {
	/** An incoming-webhook URL of Slack (or any endpoint that accepts `{ "text": "…" }`). Default: the `SLACK_WEBHOOK_URL` environment variable. */
	readonly webhookUrl?: string;
	/** The collections whose publishing is announced. Default: `["post"]`. */
	readonly collections?: readonly string[];
	/** For tests: replaces the global `fetch`. */
	readonly fetch?: typeof fetch;
}

/**
 * Sends a message to Slack when an entry is published.
 *
 * It is a plugin, not a `hooks.afterCommit` of the config, for one reason: delivery is *at least once*, so the same event can arrive twice, and a
 * plugin has a place to remember what it already sent (`cms.storage`). It works with no arguments: `plugins: [slackOnPublish()]`.
 */
export const slackOnPublish = (options: SlackOnPublishOptions = {}) =>
	definePlugin({
		name: "slack-on-publish",
		// Only JSON that the browser may read goes in `options`: the webhook URL is a secret and stays in this closure.
		options: {},
		server: async () => ({
			default: {
				// `afterCommit` runs after the change is committed. A throw is retried later with a growing delay and never undoes the publish.
				afterCommit: async (event, cms) => {
					if (event.kind !== "published" || !(options.collections ?? ["post"]).includes(event.collection)) return;

					const sent = cms.storage("slack-on-publish").collection<{ at: string }>("sent");
					if (await sent.get(event.eventId)) return; // delivered before: this try is a repeat

					const entry = await event.read();
					if (!entry?.published) return; // deleted or unpublished again since

					const webhookUrl = options.webhookUrl ?? process.env.SLACK_WEBHOOK_URL;
					if (!webhookUrl) throw new Error("slack-on-publish: set SLACK_WEBHOOK_URL (or the `webhookUrl` option)");

					const path = cms.site.contentPath(event.collection, event.publishedSlug);
					const base = cms.site.config.site?.url?.replace(/\/$/, "") ?? "";
					const title = String(entry.published.metadata.title ?? event.publishedSlug);
					const response = await (options.fetch ?? fetch)(webhookUrl, {
						method: "POST",
						headers: { "content-type": "application/json" },
						body: JSON.stringify({ text: `Published: ${title}${path ? ` ${base}${path}` : ""}` }),
					});
					if (!response.ok) throw new Error(`slack-on-publish: Slack answered ${response.status}`);

					await sent.set(event.eventId, { at: new Date().toISOString() }, { expectedVersion: 0 });
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
- The message is sent, then recorded under the event id. If Slack answers `500` the handler throws, the publish stays, and the delivery is retried (`monti events:retry`, the next write in the process, or a cron call to `/api/cms/v1/events/retry`). The test shows the message arriving once after Slack comes back, and nothing more on a second retry.
- The webhook URL is a secret, so it stays in the plugin's closure and never goes in `options` (the browser reads `options`).

## Found while writing it

- A publish that failed core validation threw only `publish_validation_failed`. Fixed: the error message now lists the issue codes (`… empty_body (body)`).
- To build the message you read the entry (`published.metadata.title`), the address (`cms.site.contentPath`) and the base URL (`cms.site.config.site.url`) from source. Documented in the README now.
