import type { MessageBundle, MessageValue, MessageVars } from "@monti-cms/core";

/**
 * Chooses the message dictionary used by modules the site config file reads (action definitions, presets, checks).
 *
 * The dictionary's `createTranslator` reads the site config. The config file imports this plugin, so those modules cannot be loaded
 * inside the modules the config file reads (circular). So the language and the site's overridden messages arrive later via `setMessageContext`. The runtime side (`registry.ts`) of server and browser
 * supplies them once after reading the config. Before that, it is English.
 */

type Overrides = Readonly<Record<string, Readonly<Record<string, MessageValue>>>>;

let language = "en";
let overrides: Overrides | undefined;

/** Sets the UI language and the site's overridden messages. */
export function setMessageContext(next: { language: string; overrides?: Overrides }): void {
	language = next.language;
	overrides = next.overrides;
}

const fillVars = (text: string, vars: MessageVars = {}) =>
	text.replace(/\{(\w+)\}/g, (whole, name: string) => (name in vars ? String(vars[name]) : whole));

/** A translate function for one dictionary. It picks the current language on every call (it can be created before the config is read). */
export function lazyTranslator<K extends string>(bundle: MessageBundle<K>) {
	return (key: K, vars?: MessageVars): string => {
		const value =
			overrides?.[bundle.namespace]?.[key] ?? bundle.messages[language]?.[key] ?? bundle.messages.en[key] ?? key;
		return typeof value === "function" ? value(vars ?? {}) : fillVars(value, vars);
	};
}
