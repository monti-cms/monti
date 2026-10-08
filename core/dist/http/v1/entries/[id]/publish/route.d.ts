/**
 * Explicit publish. The draft goes through the write pipeline (hooks, core preparation), and the store re-checks it for publishing inside the transaction;
 * on failure it returns 422 with located `issues`.
 * The publish date is the first publish time, and `resetPublishedAt` resets it to now. Image resolution problems are reported only as non-blocking `warnings`.
 */
export declare const POST: (request: Request, context?: Partial<import("../../../handler.js").RouteContext<{
    id: string;
}>> | undefined) => Promise<Response>;
