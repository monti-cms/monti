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
