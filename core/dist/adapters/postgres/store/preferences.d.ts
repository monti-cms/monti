import type { JsonObject } from "../../../core/store/types.js";
import type { StoreContext } from "./context.js";
/** Per-admin list and editor preferences. */
export declare function createPreferenceOps(ctx: StoreContext): {
    getPreferences: (params: {
        userId: string;
    }) => Promise<JsonObject | null>;
    savePreferences: (params: {
        userId: string;
        preferences: JsonObject;
    }) => Promise<void>;
};
