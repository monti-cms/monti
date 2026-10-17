/**
 * Assigns a key to the slot of an installed plugin (`Plugin.keySlots`), or clears it (`key: { use: "none" }`). A typed key is saved in the same transaction as the
 * assignment, named after the slot's service.
 */
export declare const PUT: import("../../handler.js").AdminHandler<{
    [x: string]: string;
}>;
