import { type AppOptions, loadApp } from "./app";

export interface EventsRetryOptions extends AppOptions {
	/** Also try the failed deliveries that are not due yet. */
	readonly all?: boolean;
	/** Most deliveries to try. Default 100. */
	readonly limit?: number;
}

/**
 * `monti events:retry`: loads the app's CMS instance and delivers the `afterCommit` events that are due (the retries of failed deliveries, and events a
 * stopped process never delivered), then prints what happened and how many deliveries are failed or dead. Returns `true` unless the retry itself broke, so a
 * subscriber that keeps failing does not make a cron job fail; the printed counts say so.
 */
export async function eventsRetry(options: EventsRetryOptions): Promise<boolean> {
	const log = options.log ?? console.log;
	const cms = await loadApp(options);
	try {
		const result = await cms.events.retry({ all: options.all, limit: options.limit });
		const counts = await cms.events.counts();
		log(`events: ${result.delivered} delivered, ${result.failed} failed (will retry), ${result.dead} dead-lettered`);
		log(`events waiting: ${counts.pending + counts.failed} pending or failed, ${counts.dead} dead`);
		return true;
	} catch (error) {
		console.error("Event retry failed:", error);
		return false;
	} finally {
		await cms.close();
	}
}
