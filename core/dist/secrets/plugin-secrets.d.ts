/** An older value format a plugin wrote before this API existed, so its stored values stay readable. Decrypt only: new values never use it. */
export interface LegacySecretFormat {
    /** First part of the old value (`v1` for `v1:<iv>:<tag>:<body>`). */
    readonly prefix: string;
    /** The old key was `sha256(domain + secret)`; this is the `domain` string. */
    readonly domain: string;
}
export interface PluginSecretsOptions {
    readonly legacy?: LegacySecretFormat;
}
export interface PluginSecrets {
    /** Whether the server config has a `secret`. Without one, `encrypt` and `deriveKey` throw (`secret_not_configured`) and `decrypt` only reads previous secrets' values. */
    readonly available: boolean;
    /**
     * Encrypts a string with the plugin's key (AES-256-GCM, current secret). The result carries the id of the key, so it can be told apart from
     * values made with a previous secret. Safe to store as text.
     */
    encrypt(plain: string): string;
    /**
     * Decrypts a value of this plugin. It uses the key the value names (the current secret's or a previous secret's), or the plugin's legacy
     * format if it declared one. `null` if the value is not this plugin's, was made with an unknown secret, or is corrupted.
     */
    decrypt(stored: string): string | null;
    /** Whether the value is in the current format and encrypted with the current secret. If not, `decrypt` it and `encrypt` it again. */
    isCurrent(stored: string): boolean;
    /**
     * A 32-byte key for one purpose of this plugin (signing, hashing, ...). The same plugin, purpose and current secret always give the same key;
     * any other plugin or purpose gives an unrelated one.
     */
    deriveKey(purpose: string): Buffer;
}
/**
 * The master secrets of an instance: the current one (`secret`) and the ones it replaced (`previousSecrets`). Hands out the secrets API of one plugin.
 * Only the CMS instance holds this; a plugin gets {@link PluginSecrets}.
 */
export declare function createSecretsVault(master: {
    readonly secret?: string;
    readonly previousSecrets?: readonly string[];
}): {
    forPlugin(plugin: string, options?: PluginSecretsOptions): PluginSecrets;
};
export type SecretsVault = ReturnType<typeof createSecretsVault>;
