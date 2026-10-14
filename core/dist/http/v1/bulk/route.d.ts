/** Bulk operations. Processed atomically per item, returning success or failure for each item. Every item goes through the same write pipeline as a single write. */
export declare const POST: import("../handler.js").AdminHandler<{
    [x: string]: string;
}>;
