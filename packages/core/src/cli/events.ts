import { type AppOptions, loadApp } from "./app";
import { appOptionsOf, defineCommand } from "./command";

export interface EventsRetryOptions extends AppOptions {
	/** Also try the failed deliveries that are not due yet. */
	readonly all?: boolean;
	/** Most deliveries to try. Default 100. */
	readonly limit?: number;
}

/**
 * `monti events:retry`: loads the app's CMS instance and delivers the `afterCommit` events that are due (the retries of failed deliveries, and events a
 * stopped process never delivered), then prints what happened and how many deliveries are failed or dead. Returns 0 unless the retry itself broke (that error is
 * thrown), so a subscriber that keeps failing does not make a cron job fail; the printed counts say so.
 */
export async function eventsRetry(options: EventsRetryOptions): Promise<number> {
	const { log } = options;
	const cms = await loadApp(options);
	try {
		const result = await cms.events.retry({ all: options.all, limit: options.limit });
		const counts = await cms.events.counts();
		log(`events: ${result.delivered} delivered, ${result.failed} failed (will retry), ${result.dead} dead-lettered`);
		log(`events waiting: ${counts.pending + counts.failed} pending or failed, ${counts.dead} dead`);
		return 0;
	} finally {
		await cms.close();
	}
}

export const eventsRetryCommand = defineCommand({
	name: "events:retry",
	summary:
		"Deliver the afterCommit events that are due: retries of failed deliveries, and events a stopped process never delivered (run it from a cron job)",
	options: {
		all: { type: "boolean", help: "Also try the failed deliveries that are not due yet" },
		limit: { type: "string", value: "<n>", help: "Most deliveries to try (default 100)" },
	},
	app: true,
	run: (context) => {
		const limit = context.values.limit === undefined ? undefined : Number(context.values.limit);
		if (limit !== undefined && (!Number.isInteger(limit) || limit < 1)) {
			context.error("--limit must be a positive whole number");
			return Promise.resolve(1);
		}
		return eventsRetry({ ...appOptionsOf(context), all: context.values.all, limit });
	},
});
