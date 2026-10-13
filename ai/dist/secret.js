import { AI_PLUGIN_NAME } from "./plugin-name.js";
/**
 * Service keys used to be stored inside the AI connections, encrypted with this plugin's own key (`cms.secrets("ai")`, `mk1:<key id>:<iv>:<tag>:<body>`), and
 * before that in the legacy format (`v1:<iv>:<tag>:<body>`, AES-256-GCM under `sha256("cms-ai-key:" + secret)`). They now live in the central API key store;
 * this is only what `monti db:migrate` needs to read the old values once and move them there.
 */
export const LEGACY_KEY_FORMAT = { prefix: "v1", domain: "cms-ai-key:" };
/** The secrets API of the AI plugin for one CMS instance, able to read both old formats. */
export const aiSecrets = (cms) => cms.secrets(AI_PLUGIN_NAME, { legacy: LEGACY_KEY_FORMAT });
