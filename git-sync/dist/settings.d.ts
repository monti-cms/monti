import type { ApiKeyView } from "@monti-cms/core/client";
import { type Cms } from "@monti-cms/core/plugin/server";
import type { SyncContext } from "./sync.js";
/**
 * The GitHub token is a key of the central API key store (`cms.apiKeys`) assigned to the plugin's `token` slot: the plugin reads the value from the store when it
 * calls GitHub. The secret the push webhook is signed with is the plugin's own: it is set on the plugin's admin screen, never in config, and saved in the plugin's
 * storage encrypted with the plugin's own key (`cms.secrets("git-sync")`, derived from the server config's `secret`). Neither is ever sent back to the browser: the
 * screen learns the token's key by name and last four characters, and only whether the webhook secret is set.
 */
/** The key of the store the token comes from, as the admin screen shows it. */
export type TokenKeyView = Pick<ApiKeyView, "id" | "name" | "tail" | "readable">;
/** What the admin screen learns about the saved settings. */
export interface SettingsView {
    /** Whether the server config has a `secret`: without one nothing can be saved. */
    readonly secretsAvailable: boolean;
    /** The key assigned to the token slot, or `null` when none is (or the key was deleted: that is the same as no token yet). */
    readonly token: {
        readonly key: TokenKeyView | null;
    };
    readonly webhookSecret: {
        readonly set: boolean;
        readonly readable: boolean;
    };
    /** Version of the saved settings (0 when nothing is saved yet). Sent back when saving. */
    readonly version: number;
}
export interface SettingsPatch {
    /** A new webhook secret, `null` to forget it, absent to keep it. */
    readonly webhookSecret?: string | null;
    readonly expectedVersion: number;
}
/** The key assigned to the plugin's token slot, or `null` when none is. */
export declare function tokenKeyOf(cms: Cms): Promise<TokenKeyView | null>;
export declare function settingsView(ctx: SyncContext): Promise<SettingsView>;
export declare function saveSettings(ctx: SyncContext, patch: SettingsPatch): Promise<SettingsView>;
/** The saved webhook secret, or `null` when none is saved (or it cannot be read). */
export declare function readWebhookSecret(ctx: SyncContext): Promise<string | null>;
