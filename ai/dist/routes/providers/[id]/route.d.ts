type IdParams = {
    id: string;
};
/** Edits a connection. If the key is omitted, the stored key is kept (deleted if the address changed); `null` deletes it. */
export declare const PATCH: import("@monti-cms/core/plugin/server").AdminHandler<IdParams>;
/** Deletes a connection. Actions that chose it fall back to the first connection suited to their kind. */
export declare const DELETE: import("@monti-cms/core/plugin/server").AdminHandler<IdParams>;
export {};
