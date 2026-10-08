import { AiError } from "./errors.js";
import { AI_PLUGIN_NAME } from "./plugin-name.js";
import { providerMessages } from "./provider.messages.js";
const noSecretMessage = (site) => site.createTranslator(providerMessages)("noSecret");
/**
 * Encryption of AI service keys. The CMS instance derives this plugin's own key from the config's one secret (`MONTI_SECRET`) and the plugin name
 * (`cms.secrets("ai")`), so the plugin never sees the master secret. Keys are stored as `mk1:<key id>:<iv>:<tag>:<body>`.
 *
 * Keys stored before per-plugin keys (`v1:<iv>:<tag>:<body>`, AES-256-GCM under `sha256("cms-ai-key:" + secret)`) still decrypt through the legacy
 * format below, with the current secret or a previous one. They are encrypted again in the current format the next time the AI connections are
 * saved, and on `monti migrate`, so no manual step is needed.
 */
export const LEGACY_KEY_FORMAT = { prefix: "v1", domain: "cms-ai-key:" };
/** The secrets API of the AI plugin for one CMS instance. */
export const aiSecrets = (cms) => cms.secrets(AI_PLUGIN_NAME, { legacy: LEGACY_KEY_FORMAT });
/** Stand-in for an instance without secrets (a store built without `secrets`): nothing can be stored or read. */
export const noSecretsOf = (site) => ({
    available: false,
    encrypt: () => {
        throw new AiError("ai_unavailable", noSecretMessage(site));
    },
    decrypt: () => null,
    isCurrent: () => false,
    deriveKey: () => {
        throw new AiError("ai_unavailable", noSecretMessage(site));
    },
});
export function encryptSecret(site, plain, secrets) {
    if (!secrets.available)
        throw new AiError("ai_unavailable", noSecretMessage(site));
    return secrets.encrypt(plain);
}
/** `null` if it cannot be decrypted (`secret` changed without listing the old one in `previousSecrets`, or the value is corrupted). */
export const decryptSecret = (stored, secrets) => secrets.decrypt(stored);
/**
 * The stored key encrypted again with the current secret, if it is in the legacy format or was made with a previous secret.
 * The value as it is when it is current already or cannot be decrypted (nothing is lost by leaving it).
 */
export function refreshSecret(stored, secrets) {
    if (!secrets.available || secrets.isCurrent(stored))
        return stored;
    const plain = secrets.decrypt(stored);
    return plain === null ? stored : secrets.encrypt(plain);
}
/** The last four characters of the key, shown on screen. */
export const keyHint = (plain) => (plain ? `…${plain.slice(-4)}` : null);
