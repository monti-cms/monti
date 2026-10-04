/**
 * Code block line effect definitions (`// @line name {2-4}`). Adds the site config's `codeBlock.lineEffects` to the core defaults
 * (highlight, plus, minus, warning, error). A site definition replaces one with the same name.
 *
 * A definition sets the storage syntax (comment name), public view class, and editor display in one place. It goes into the config, so it holds only
 * JSON-serializable values. Line folding (`collapse`) and the body-link label (`anchor`) are core effects with their own behavior, so they are not here.
 *
 * This file does not read the config (the config file imports this type through the authoring API). The list the site uses is in `active.ts`.
 */
/** Editor display. Kept separate from the public view class (the public view draws line-leading markers with CSS). */
export interface CodeLineEffectEditor {
    /** Line background class. */
    readonly background?: string;
    /** Color class of the wavy underline across the whole line (e.g. `decoration-red-500`). */
    readonly wavy?: string;
    /** Marker text in the line number column and its class (e.g. `+`). If a line has several, the earliest in definition order is shown. */
    readonly marker?: {
        readonly text: string;
        readonly className?: string;
    };
}
export interface CodeLineEffectDefinition {
    /** Comment name (`// @line name`). Lowercase kebab-case. */
    readonly name: string;
    /** Line effect menu label. Keep it short. */
    readonly label: string;
    /** Menu icon (lucide name). Must be a name registered in the admin UI. */
    readonly icon?: string;
    /** Class the public view adds to that line. */
    readonly class: string;
    readonly editor?: CodeLineEffectEditor;
}
/** The site config's code block settings. */
export interface CodeBlockConfig {
    /** Line effects. Added to the core defaults; same name replaces. The menu is the defaults followed by added ones in order. */
    readonly lineEffects?: readonly CodeLineEffectDefinition[];
}
/** Core default line effects. Declaration order is the order in the line effect menu. */
export declare const DEFAULT_CODE_LINE_EFFECTS: readonly CodeLineEffectDefinition[];
/** Checks that the site config is valid. Reports at app startup if wrong. */
export declare function validateCodeBlockConfig(config: CodeBlockConfig | undefined): void;
/** Merges site definitions into the default line effects. A same name is replaced in place; a new name is appended. */
export declare function resolveCodeLineEffects(added: readonly CodeLineEffectDefinition[] | undefined): readonly CodeLineEffectDefinition[];
