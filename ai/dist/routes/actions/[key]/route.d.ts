type KeyParams = {
    key: string;
};
/**
 * Saves editable values (enable, accept requests, connection, model, input to send, instructions, thresholds, checks). Values equal to the defaults are not kept.
 * Screen actions also edit `base` (name, where it attaches, result shape).
 */
export declare const PATCH: (request: Request, context?: Partial<import("@monti-cms/core/plugin/server").RouteContext<KeyParams>> | undefined) => Promise<Response>;
/** Deletes a screen action (`?expectedVersion=`). Code actions cannot be deleted. */
export declare const DELETE: (request: Request, context?: Partial<import("@monti-cms/core/plugin/server").RouteContext<KeyParams>> | undefined) => Promise<Response>;
export {};
