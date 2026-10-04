import { type MessageBundle, type MessageValue, type MessageVars, translate } from "./define";

/**
 * The UI locale in use and the text the site overrides. It does not read the site config, so it can be used from the authoring API (modules the `cms.config.ts` imports) too.
 * The values are filled in from the site config when `./index` is loaded (English before that).
 *
 * Used by labels in modules the config file reads, such as block definitions and line-effect definitions. Labels pick the text when it is read (getter),
 * so it does not depend on the order in which modules were loaded.
 */

type Overrides = Readonly<Record<string, Readonly<Record<string, MessageValue>>>>;

let language = "en";
let overrides: Overrides | undefined;

/** Sets the UI locale and the overridden text (`./index` calls it with the site config). */
export function setActiveLocale(next: string, nextOverrides?: Overrides): void {
	language = next;
	overrides = nextOverrides;
}

/** Current UI locale (leading part, e.g. `ko`). */
export const activeLanguage = (): string => language;

/**
 * Translator for one dictionary. Picks the current UI locale on every call. Used in modules the config file reads (elsewhere use `createTranslator`).
 */
export function createActiveTranslator<K extends string>(bundle: MessageBundle<K>) {
	return (key: K, vars?: MessageVars): string => translate(bundle, language, key, vars, overrides);
}
