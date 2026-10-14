export interface PluginSecrets {
    /** Whether the server config has a `secret`. Without one, `encrypt` and `deriveKey` throw (`secret_not_configured`) and `decrypt` only reads previous secrets' values. */
    readonly available: boolean;
    /**
     * Encrypts a string with the plugin's key (AES-256-GCM, current secret). The result carries the id of the key, so it can be told apart from
     * values made with a previous secret. Safe to store as text.
     */
    encrypt(plain: string): string;
    /**
     * Decrypts a value of this plugin. It uses the key the value names (the current secret's or a previous secret's). `null` if the value is not this plugin's, was made with an unknown secret, or is corrupted.
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
    forPlugin(plugin: string): PluginSecrets;
};
