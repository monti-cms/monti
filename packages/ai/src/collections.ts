/** Collections of the AI plugin's storage (`plugin.storage` of `ai`). The names are the ones the tables had before the plugin used the storage API. */
export const AI_COLLECTIONS = {
	/** What the connection check learned about each model of each connection: does it call tools (the admin agent needs that)? One item per connection id. */
	agentTools: "agent-tools",
	/** Conversations of the admin agent, one item per run, keyed `<admin id>/<run id>`. */
	agentRuns: "agent-runs",
	/** The AI settings: one item, `default` (the quick-task model, how long unopened conversations stay). */
	settings: "settings",
} as const;
