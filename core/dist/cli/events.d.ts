import { type AppOptions } from "./app.js";
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
export declare function eventsRetry(options: EventsRetryOptions): Promise<boolean>;
