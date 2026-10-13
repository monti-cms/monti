/**
 * Assigns a key to the slot of an installed plugin (`CmsPlugin.keySlots`), or clears it (`key: { use: "none" }`). A typed key is saved in the same transaction as the
 * assignment, named after the slot's service.
 */
export declare const PUT: (request: Request, context?: Partial<import("../../handler.js").RouteContext<{
    [x: string]: string;
}>> | undefined) => Promise<Response>;
