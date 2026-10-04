import { cmsConfig } from "../config/resolved";
import { setActiveLocale } from "./active";
import { type MessageBundle, type MessageVars, translate } from "./define";

export * from "./define";

/**
 * Admin UI locale (BCP 47). The site config's `admin.locale`, else the site default locale (`defaultLocale`). Date and number formatting follow it.
 */
export const ADMIN_LANGUAGE_TAG: string = cmsConfig.admin?.locale ?? cmsConfig.defaultLocale;

/** Locale used to pick the dictionary (leading part, e.g. `ko-KR` -> `ko`). */
export const ADMIN_LANGUAGE: string = ADMIN_LANGUAGE_TAG.split("-")[0]?.toLowerCase() ?? "en";

/**
 * Translator for one dictionary. Picks by the admin UI locale and prefers text the site overrides with `admin.messages`.
 *
 * ```ts
 * const t = createTranslator(messages);
 * t("save"); t("deleted", { name });
 * ```
 */
export function createTranslator<K extends string>(bundle: MessageBundle<K>, language: string = ADMIN_LANGUAGE) {
	return (key: K, vars?: MessageVars): string => translate(bundle, language, key, vars, cmsConfig.admin?.messages);
}

// Labels in modules read by the config file (block and line-effect definitions) use the same locale and overridden text too.
setActiveLocale(ADMIN_LANGUAGE, cmsConfig.admin?.messages);
