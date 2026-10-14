import type { ApiKeyView } from "@monti-cms/core/client";
import type { Cms } from "@monti-cms/core/plugin/server";
/**
 * The plugin holds two secrets, both keys of the central API key store (`cms.apiKeys`) assigned to the plugin's key slots (`keySlots` in `index.ts`):
 * the GitHub `token` it calls GitHub with, and the `webhook-secret` the push webhook is signed with. The plugin reads each value from the store when it needs it;
 * neither is ever sent to the browser, which learns a key by its name and last four characters.
 */
/** A key of the store as the admin screen shows it. */
export type SlotKeyView = Pick<ApiKeyView, "id" | "name" | "tail" | "readable">;
/** What the admin screen learns about the two keys. */
export interface KeysView {
    /** Whether the server config has a `secret`: without one nothing can be saved. */
    readonly secretsAvailable: boolean;
    /** The key assigned to the token slot, or `null` when none is (or the key was deleted: that is the same as no token yet). */
    readonly token: SlotKeyView | null;
    readonly webhookSecret: SlotKeyView | null;
}
/** The key assigned to one of the plugin's slots, or `null` when none is. */
export declare function slotKeyOf(cms: Cms, slot: string): Promise<SlotKeyView | null>;
export declare const tokenKeyOf: (cms: Cms) => Promise<SlotKeyView | null>;
export declare function keysView(cms: Cms): Promise<KeysView>;
/** The webhook secret, or `null` when none is assigned (or it cannot be read). */
export declare const readWebhookSecret: (cms: Cms) => Promise<string | null>;
