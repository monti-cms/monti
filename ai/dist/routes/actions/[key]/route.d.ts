type KeyParams = {
    key: string;
};
/**
 * Saves editable values (enable, accept requests, connection, model, input to send, instructions, thresholds, checks). Values equal to the defaults are not kept.
 * Screen actions also edit `base` (name, where it attaches, result shape).
 */
export declare const PATCH: import("@monti-cms/core/plugin/server").AdminHandler<KeyParams>;
/** Deletes a screen action (`?expectedVersion=`). Code actions cannot be deleted. */
export declare const DELETE: import("@monti-cms/core/plugin/server").AdminHandler<KeyParams>;
export {};
