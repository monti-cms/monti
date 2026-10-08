import { type MessageBundle, type MessageValue, type MessageVars } from "./define.js";
/**
 * The language that labels written in modules the config file reads (block definitions, line-effect definitions) are picked in. It does not read the site config,
 * so it can be used from the authoring API (modules `cms.config.ts` imports) too.
 *
 * Those labels are getters, because the language is not known when the config file imports them. `createSite` is the one place that reads them: it resolves the
 * definitions inside `withActiveLocale(...)` and keeps the plain text, so a site's labels never depend on any other site and nothing here outlives the call.
 * Outside such a call the language is English.
 */
type Overrides = Readonly<Record<string, Readonly<Record<string, MessageValue>>>>;
/** Runs `read` with the labels of definitions picked in `nextLanguage` (and `nextOverrides` text), then restores what was set before. Synchronous only. */
export declare function withActiveLocale<T>(nextLanguage: string, nextOverrides: Overrides | undefined, read: () => T): T;
/** Current language of definition labels (leading part, e.g. `ko`). English outside `withActiveLocale`. */
export declare const activeLanguage: () => string;
/**
 * Translator for one dictionary, for the getters of definitions. Picks the language set by `withActiveLocale` on every call. Used in modules the config file reads;
 * code that runs with a site uses `site.createTranslator(bundle)`.
 */
export declare function createActiveTranslator<K extends string>(bundle: MessageBundle<K>): (key: K, vars?: MessageVars) => string;
/**
 * Copies `value` with every getter read (the text of labels in the active language) and nothing else changed: plain objects and arrays are copied,
 * functions and other values are kept as they are.
 */
export declare function resolveLabels<T>(value: T): T;
export {};
