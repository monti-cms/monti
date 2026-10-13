import type { Cms, LegacySecretFormat, PluginSecrets } from "@monti-cms/core/plugin/server";
/**
 * Service keys used to be stored inside the AI connections, encrypted with this plugin's own key (`cms.secrets("ai")`, `mk1:<key id>:<iv>:<tag>:<body>`), and
 * before that in the legacy format (`v1:<iv>:<tag>:<body>`, AES-256-GCM under `sha256("cms-ai-key:" + secret)`). They now live in the central API key store;
 * this is only what `monti db:migrate` needs to read the old values once and move them there.
 */
export declare const LEGACY_KEY_FORMAT: LegacySecretFormat;
/** The secrets API of the AI plugin for one CMS instance, able to read both old formats. */
export declare const aiSecrets: (cms: Cms) => PluginSecrets;
