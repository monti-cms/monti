/**
 * Explicit publish. The draft goes through the write pipeline (hooks, core preparation), and the store re-checks it for publishing inside the transaction;
 * on failure it returns 422 with located `issues`.
 * The publish date is the first publish time, and `resetPublishedAt` resets it to now. Image resolution problems are reported only as non-blocking `warnings`
 * (the content service adds them, so a bulk publish reports the same).
 */
export declare const POST: import("../../../handler.js").AdminHandler<{
    id: string;
}>;
