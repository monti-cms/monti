import { type MessageBundle, type MessageValue, type MessageVars } from "./define.js";
/**
 * The UI locale in use and the text the site overrides. It does not read the site config, so it can be used from the authoring API (modules the `cms.config.ts` imports) too.
 * The values are filled in from the site config when `./index` is loaded (English before that).
 *
 * Used by labels in modules the config file reads, such as block definitions and line-effect definitions. Labels pick the text when it is read (getter),
 * so it does not depend on the order in which modules were loaded.
 */
type Overrides = Readonly<Record<string, Readonly<Record<string, MessageValue>>>>;
/** Sets the UI locale and the overridden text (`./index` calls it with the site config). */
export declare function setActiveLocale(next: string, nextOverrides?: Overrides): void;
/** Current UI locale (leading part, e.g. `ko`). */
export declare const activeLanguage: () => string;
/**
 * Translator for one dictionary. Picks the current UI locale on every call. Used in modules the config file reads (elsewhere use `createTranslator`).
 */
export declare function createActiveTranslator<K extends string>(bundle: MessageBundle<K>): (key: K, vars?: MessageVars) => string;
export {};
