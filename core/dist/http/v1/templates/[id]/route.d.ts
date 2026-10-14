type IdParams = {
    id: string;
};
export declare const GET: import("../../handler.js").AdminHandler<IdParams>;
/** Without a body the stored one is kept. Blocks keep their ids where the new body pairs with the old one. */
export declare const PATCH: import("../../handler.js").AdminHandler<IdParams>;
export declare const DELETE: import("../../handler.js").AdminHandler<IdParams>;
export {};
