/**
 * UI message dictionaries. The core, admin and extensions use messages by name (key), with one dictionary per locale. It does not read the site config (`cms.config.ts`),
 * so it can be used from the config file and the authoring API too (locale picking is done by `./index`).
 *
 * - A value is a string or a function that fills `{name}` placeholders. Words that change by the preceding word, like Korean particles, are written as functions (`josa`).
 * - English (`en`) has every key. Keys missing in other locales show in English.
 */
export type MessageVars = Readonly<Record<string, string | number>>;
export type MessageValue = string | ((vars: MessageVars) => string);
export type MessageDict<K extends string = string> = Readonly<Record<K, MessageValue>>;
/** Dictionaries per locale for one group (namespace). `en` has every key. */
export interface MessageBundle<K extends string = string> {
    readonly namespace: string;
    readonly messages: {
        readonly en: MessageDict<K>;
    } & Readonly<Record<string, Partial<MessageDict<K>>>>;
}
/** Creates a dictionary (only fits the types). Key names come from the `en` dictionary. */
export declare function defineMessages<const K extends string>(namespace: string, messages: {
    readonly en: MessageDict<K>;
} & Readonly<Record<string, Partial<MessageDict<K>>>>): MessageBundle<K>;
/** Fills `{name}` placeholders. Unknown names are left as they are. */
export declare const fillVars: (text: string, vars?: MessageVars) => string;
/** Attaches a Korean particle that fits the word. `josa("태그", "을", "를")` -> `태그를`. Used by function messages in the Korean dictionary. */
export declare const josa: (word: string, withFinal: string, withoutFinal: string) => string;
/** Picks a message from the dictionary: site override -> that locale -> English -> key. */
export declare function translate<K extends string>(bundle: MessageBundle<K>, language: string, key: K, vars?: MessageVars, overrides?: Readonly<Record<string, Readonly<Record<string, MessageValue>>>>): string;
