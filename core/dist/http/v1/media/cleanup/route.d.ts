/**
 * Cleans up incomplete or failed uploads older than 24 hours. No external cron is needed.
 * Items whose file deletion failed are kept and retried on the next cleanup.
 */
export declare const POST: import("../../handler.js").AdminHandler<{
    [x: string]: string;
}>;
