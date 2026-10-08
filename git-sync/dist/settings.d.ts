import type { SyncContext } from "./sync.js";
/**
 * The GitHub token and the secret the push webhook is signed with are set on the plugin's admin screen, never in config. They are saved in the plugin's storage
 * encrypted with the plugin's own key (`cms.secrets("git-sync")`, derived from the server config's `secret`). They are never sent back to the browser: the
 * screen only learns whether each is set (and the last four characters of the token, to tell tokens apart).
 */
/** What the admin screen learns about the saved settings. */
export interface SettingsView {
    /** Whether the server config has a `secret`: without one nothing can be saved. */
    readonly secretsAvailable: boolean;
    readonly token: {
        readonly set: boolean;
        readonly hint: string | null;
        readonly readable: boolean;
    };
    readonly webhookSecret: {
        readonly set: boolean;
        readonly readable: boolean;
    };
    /** Version of the saved settings (0 when nothing is saved yet). Sent back when saving. */
    readonly version: number;
}
export interface SettingsPatch {
    /** A new token, `null` to forget it, absent to keep it. */
    readonly token?: string | null;
    readonly webhookSecret?: string | null;
    readonly expectedVersion: number;
}
export declare function settingsView(ctx: SyncContext): Promise<SettingsView>;
export declare function saveSettings(ctx: SyncContext, patch: SettingsPatch): Promise<SettingsView>;
/** The saved webhook secret, or `null` when none is saved (or it cannot be read). */
export declare function readWebhookSecret(ctx: SyncContext): Promise<string | null>;
