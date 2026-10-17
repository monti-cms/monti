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
