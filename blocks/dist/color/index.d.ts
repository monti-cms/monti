import { type PaletteColor } from "./colors.js";
export * from "./colors.js";
export { colorBlock } from "./definition.js";
export interface ColorOptions {
    /** Editor text/background color picker list. Defaults to the 8 default colors (`DEFAULT_TEXT_PALETTE`). The body stores hex values. */
    readonly palette?: readonly PaletteColor[];
}
/**
 * Text color and text background color (`:color[text]{fg bg …}`). Add it to the site config's `plugins`.
 *
 * ```ts
 * plugins: [color({ palette: [...] })]
 * ```
 *
 * The editor gets a `Text color` item in the format toolbar and text bubble. The public page is drawn by this extension's default `Color` component (`textColorProps`),
 * and the color is picked for the theme by this package's `styles.css` (`.cms-color`).
 */
export declare const color: (options?: ColorOptions) => import("@monti-cms/core").CmsPlugin<"color", ColorOptions> & {
    readonly contributes?: Readonly<Record<string, unknown>> | undefined;
};
