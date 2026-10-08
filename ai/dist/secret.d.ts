import type { Site } from "@monti-cms/core/client";
import type { Cms, LegacySecretFormat, PluginSecrets } from "@monti-cms/core/plugin/server";
/** The sites a message is written for: anything that has a translator for the admin language. */
type SecretSite = Pick<Site, "createTranslator">;
/**
 * Encryption of AI service keys. The CMS instance derives this plugin's own key from the config's one secret (`MONTI_SECRET`) and the plugin name
 * (`cms.secrets("ai")`), so the plugin never sees the master secret. Keys are stored as `mk1:<key id>:<iv>:<tag>:<body>`.
 *
 * Keys stored before per-plugin keys (`v1:<iv>:<tag>:<body>`, AES-256-GCM under `sha256("cms-ai-key:" + secret)`) still decrypt through the legacy
 * format below, with the current secret or a previous one. They are encrypted again in the current format the next time the AI connections are
 * saved, and on `monti migrate`, so no manual step is needed.
 */
export declare const LEGACY_KEY_FORMAT: LegacySecretFormat;
/** The secrets API of the AI plugin for one CMS instance. */
export declare const aiSecrets: (cms: Cms) => PluginSecrets;
/** Stand-in for an instance without secrets (a store built without `secrets`): nothing can be stored or read. */
export declare const noSecretsOf: (site: SecretSite) => PluginSecrets;
export declare function encryptSecret(site: SecretSite, plain: string, secrets: PluginSecrets): string;
/** `null` if it cannot be decrypted (`secret` changed without listing the old one in `previousSecrets`, or the value is corrupted). */
export declare const decryptSecret: (stored: string, secrets: PluginSecrets) => string | null;
/**
 * The stored key encrypted again with the current secret, if it is in the legacy format or was made with a previous secret.
 * The value as it is when it is current already or cannot be decrypted (nothing is lost by leaving it).
 */
export declare function refreshSecret(stored: string, secrets: PluginSecrets): string;
/** The last four characters of the key, shown on screen. */
export declare const keyHint: (plain: string | null) => string | null;
export {};
