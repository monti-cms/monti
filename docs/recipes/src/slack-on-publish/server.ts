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
