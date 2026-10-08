/**
 * Text color and text background color (`:color[text]{fg="#…" fgDark="#…" bg="#…" bgDark="#…"}`).
 * The body stores colors as hex values, not names. Light and dark theme values are paired, and when there is no dark value
 * the light value is used as is. The editor's picker list is the extension option `color({ palette })`, falling back to the default presets below.
 * Custom-picked colors are stored in the same shape.
 */
/** Picks the text of a default color name (`site.createTranslator(colorMessages)` in the admin, `translate(colorMessages, language, key)` elsewhere). */
export type PaletteText = (key: `palette.${"gray" | "red" | "orange" | "yellow" | "green" | "blue" | "purple" | "pink"}`) => string;
export interface ColorPair {
    readonly light: string;
    readonly dark: string;
}
export interface PaletteColor {
    readonly id: string;
    readonly name: string;
    /** Text color. */
    readonly fg: ColorPair;
    /** Text background color. */
    readonly bg: ColorPair;
}
/** Default picker list, with the color names in the language `t` picks. Change it with the extension option `color({ palette })`. */
export declare const defaultTextPalette: (t: PaletteText) => readonly PaletteColor[];
/** Attributes of the body `:color`. An empty value means that color is not used. */
export interface TextColorAttrs {
    fg?: string | null;
    fgDark?: string | null;
    bg?: string | null;
    bgDark?: string | null;
}
export declare const TEXT_COLOR_ATTRS: readonly ["fg", "fgDark", "bg", "bgDark"];
/** Accepts only `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`. Other values are dropped because they go straight into styles. */
export declare const isHexColor: (value: unknown) => value is string;
/** Keeps only the usable values from the attributes (lowercase). Returns an empty object if nothing remains. */
export declare function cleanTextColor(attrs: Readonly<Record<string, unknown>> | null | undefined): TextColorAttrs;
export declare const hasTextColor: (attrs: TextColorAttrs) => boolean;
/**
 * Display attributes shared by the public page and the editor. CSS (`.cms-color`, this package's `render.css` for the public page and `styles.css` for the editor) picks the variable for the theme.
 * Color is applied only when `data-fg` or `data-bg` is present.
 */
export declare function textColorProps(attrs: TextColorAttrs): {
    className: string;
    "data-fg"?: "";
    "data-bg"?: "";
    style: Record<string, string>;
};
/** The preset if the color matches one. Used to mark the current color in the picker list. */
export declare function paletteOf(kind: "fg" | "bg", attrs: TextColorAttrs, palette: readonly PaletteColor[]): PaletteColor | undefined;
/** Checks that the picker list (`color({ palette })`) is valid (hex values, unique `id`s). */
export declare function validateTextPalette(palette: readonly PaletteColor[] | undefined): void;
