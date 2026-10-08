# Send a Slack message when a post is published

Goal: when a post is published, post one message to a Slack channel (or any endpoint that takes `{ "text": "…" }`) with its title and address. If Slack is down the publish still works, and the message arrives later, once.

Code: [`examples/recipes/src/slack-on-publish`](../../examples/recipes/src/slack-on-publish). Test: `slack-on-publish.test.ts`.

## What you need to know

1. **`afterCommit` is a notification after the change is committed.** It never blocks or undoes a write ("Event delivery" in the [core README](../../packages/core/README.md)).
2. **It is delivered from an outbox**: at least once, in order per entry, retried with a growing delay when it throws. So the handler must be idempotent: the same event can arrive twice.
3. **`event.once(run)` is the idempotency helper.** It runs `run` one time per event and subscriber: a repeat skips it, and a `run` that throws is not marked, so the retry runs it again. No storage code of your own.
4. **Every `afterCommit` gets the instance**: `afterCommit(event, cms)`, in the config's `hooks` and in a plugin's alike, so it can read its storage, the site and the entry.
5. **`event.read()`** returns the committed entry now (`null` if it was deleted): the event itself carries ids, the kind and slugs, never the body.
6. **A plugin's `hooks` can be inline or in a lazy `server` module.** This one calls out over the network and has its own settings, so it uses the lazy `server` module (see "Inline or `server`" below).

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
 * It is a plugin with a lazy `server` module, not an inline `hooks`, because it calls out over the network and keeps its own settings: inline
 * hooks load with every server start (the CLI and cold starts included), a `server` module loads when it is needed. It works with no arguments: `plugins: [slackOnPublish()]`.
 */
export const slackOnPublish = (options: SlackOnPublishOptions = {}) =>
	definePlugin({
		name: "slack-on-publish",
		// Only JSON that the browser may read goes in `options`: the webhook URL is a secret and stays in this closure.
		options: {},
		server: async () => ({
			default: {
				hooks: {
					// `afterCommit` runs after the change is committed. A throw is retried later with a growing delay and never undoes the publish.
					afterCommit: async (event, cms) => {
						if (event.kind !== "published" || !(options.collections ?? ["post"]).includes(event.collection)) return;

						// Delivery is at least once, so the same event can come again. `once` runs the work for this event one time: a repeat skips it,
						// and a throw inside leaves it unmarked, so the retry sends the message.
						await event.once(async () => {
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
						});
					},
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
- The message is sent inside `event.once`, and the event is marked done when the function returns. If Slack answers `500` the function throws, nothing is marked, the publish stays, and the delivery is retried (`monti events:retry`, the next write in the process, or a cron call to `/api/cms/v1/events/retry`). The test shows the message arriving once after Slack comes back, and nothing more on a second retry.
- `once` is "at most once unless the process dies between the end of the function and the mark". A crash in that gap sends the message twice, which is what at-least-once delivery means. The marks are kept as long as the events are (`events.retentionDays`).
- The webhook URL is a secret, so it stays in the plugin's closure and never goes in `options` (the browser reads `options`).

## Inline or `server`

A plugin's write hooks (`transform`, `validate`, `validatePublish`, `afterCommit`) can sit in two places:

- **Inline**: `definePlugin({ name: "audit", hooks: { afterCommit } })`. No module file. Inline hooks load with every server start (the CLI, edge and cold starts included), so use this when they are light. They may use secrets through `cms.secrets` or the environment; `monti.config.ts` is server-only and never reaches the browser. The [slug rule](slug-rule.md#as-a-plugin) is the example.
- **In the lazy `server` module**: `server: async () => ({ default: { hooks } })`. Loaded when it is needed, and the place for heavy code (an SDK, a database client) and for a plugin that has routes, migrations, commands or checks. This recipe uses it because it is a network client.

Set the hooks in one of the two, not both: a plugin with hooks in both places fails when it loads.

## Found while writing it

- Every subscriber needed the same "remember the `eventId`" code (the first version kept a `sent` collection in plugin storage). Fixed: `event.once(run)`.
- The config's `hooks.afterCommit` got no `cms`, unlike a plugin's. Fixed: every `afterCommit` gets `(event, cms)`, and a plugin has one `afterCommit` place: `hooks`.
- A publish that failed core validation threw only `publish_validation_failed`. Fixed: the error message now lists the issue codes (`… empty_body (body)`).
- To build the message you read the entry (`published.metadata.title`), the address (`cms.site.contentPath`) and the base URL (`cms.site.config.site.url`) from source. Documented in the README now.
