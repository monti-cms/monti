import { type MessageBundle, type MessageVars } from "./define.js";
export * from "./define.js";
/**
 * Admin UI locale (BCP 47). The site config's `admin.locale`, else the site default locale (`defaultLocale`). Date and number formatting follow it.
 */
export declare const ADMIN_LANGUAGE_TAG: string;
/** Locale used to pick the dictionary (leading part, e.g. `ko-KR` -> `ko`). */
export declare const ADMIN_LANGUAGE: string;
/**
 * Translator for one dictionary. Picks by the admin UI locale and prefers text the site overrides with `admin.messages`.
 *
 * ```ts
 * const t = createTranslator(messages);
 * t("save"); t("deleted", { name });
 * ```
 */
export declare function createTranslator<K extends string>(bundle: MessageBundle<K>, language?: string): (key: K, vars?: MessageVars) => string;
