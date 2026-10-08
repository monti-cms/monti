/**
 * Shiki code notation (`// [!code ++]`) → Monti code annotation comments (`// @line plus`).
 *
 * Reading only: the notation is removed from the code and the equivalent Monti annotation lines are put above the lines it affects.
 * Monti's parser then reads them like any other annotation, and the body is always written back in Monti's notation.
 *
 * What counts as notation is a `[!code …]` marker in a **trailing comment** of the language's comment syntax (found outside quotes),
 * the same place Shiki's transformers look. A comment that holds only the notation is removed with its line and applies to the next code line;
 * a trailing one applies to its own line. `[!code …:N]` extends it over N code lines.
 */
import { type CommentSyntax } from "@monti-cms/mdx";
/** Text effect a `[!code word:…]` becomes (`@char name {re:/…/g}`). */
export type WordEffect = "strong" | "em" | "del" | "u";
export interface NotationSettings {
    /** Whether `[!code word:…]` is converted, and to which text effect. `false` leaves it as it is. */
    readonly word: WordEffect | false;
    /** Names of the line effects the site uses. Decides what `focus` and `info` become. */
    readonly lineEffects: ReadonlySet<string>;
}
/**
 * Comment forms a Shiki notation is read from in a language: the form Monti's own annotations use there, plus the other forms the language has.
 * Every `//` language also reads the block form (slash, star, text, star, slash).
 */
export declare const readableCommentSyntaxes: (lang: string) => CommentSyntax[];
/** Converts the Shiki notation in the value of a code node of language `lang`. Code without notation is returned as it is. */
export declare const convertShikiNotation: (value: string, lang: string | null | undefined, settings: NotationSettings) => string;
