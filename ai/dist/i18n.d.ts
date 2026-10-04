import type { MessageBundle, MessageValue, MessageVars } from "@monti-cms/core";
/**
 * Chooses the message dictionary used by modules the site config file reads (action definitions, presets, checks).
 *
 * The dictionary's `createTranslator` reads the site config. The config file imports this plugin, so those modules cannot be loaded
 * inside the modules the config file reads (circular). So the language and the site's overridden messages arrive later via `setMessageContext`. The runtime side (`registry.ts`) of server and browser
 * supplies them once after reading the config. Before that, it is English.
 */
type Overrides = Readonly<Record<string, Readonly<Record<string, MessageValue>>>>;
/** Sets the UI language and the site's overridden messages. */
export declare function setMessageContext(next: {
    language: string;
    overrides?: Overrides;
}): void;
/** A translate function for one dictionary. It picks the current language on every call (it can be created before the config is read). */
export declare function lazyTranslator<K extends string>(bundle: MessageBundle<K>): (key: K, vars?: MessageVars) => string;
export {};
