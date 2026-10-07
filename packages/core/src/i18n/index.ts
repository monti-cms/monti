import type { AdminConfig } from "../config/define";
import { type MessageBundle, type MessageVars, translate } from "./define";

export * from "./define";

/** A translator for one dictionary: picks the text for its key, with `{name}` placeholders filled. */
export type Translator<K extends string = string> = (key: K, vars?: MessageVars) => string;

/** Language used to pick the dictionary from an admin locale (leading part, e.g. `ko-KR` -> `ko`). */
export const languageOf = (locale: string): string => locale.split("-")[0]?.toLowerCase() ?? "en";

/**
 * Translator for one dictionary in one language, preferring the text the site overrides with `admin.messages`. Nothing is read from a site config: the
 * language and the overrides are given. Code that runs with a site gets one from it (`site.createTranslator(bundle)`, `useTranslator(bundle)` in React).
 *
 * ```ts
 * const t = createTranslator(messages, "ko");
 * t("save"); t("deleted", { name });
 * ```
 */
export function createTranslator<K extends string>(
	bundle: MessageBundle<K>,
	language: string,
	overrides?: AdminConfig["messages"],
): Translator<K> {
	return (key, vars) => translate(bundle, language, key, vars, overrides);
}

/** What a site knows about the language of the admin UI. */
export interface SiteI18n {
	/**
	 * Admin UI locale (BCP 47). The site config's `admin.locale`, else the site default locale (`defaultLocale`). Date and number formatting follow it.
	 */
	readonly ADMIN_LANGUAGE_TAG: string;
	/** Locale used to pick the dictionary (leading part, e.g. `ko-KR` -> `ko`). */
	readonly ADMIN_LANGUAGE: string;
	/** Translator for one dictionary in the admin UI language, preferring the text the site overrides with `admin.messages`. */
	createTranslator<K extends string>(bundle: MessageBundle<K>): Translator<K>;
}

/** The language of the admin UI of a site config. */
export function createI18n(config: {
	readonly defaultLocale: string;
	readonly admin?: Pick<AdminConfig, "locale" | "messages">;
}): SiteI18n {
	const ADMIN_LANGUAGE_TAG = config.admin?.locale ?? config.defaultLocale;
	const ADMIN_LANGUAGE = languageOf(ADMIN_LANGUAGE_TAG);
	return {
		ADMIN_LANGUAGE_TAG,
		ADMIN_LANGUAGE,
		createTranslator: (bundle) => createTranslator(bundle, ADMIN_LANGUAGE, config.admin?.messages),
	};
}
