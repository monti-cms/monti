import { type PaletteColor } from "./colors.js";
export * from "./colors.js";
export { colorBlock } from "./definition.js";
export interface ColorOptions {
    /** Editor text/background color picker list. Defaults to the 8 default colors (`defaultTextPalette`). The body stores hex values. */
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
 * and the color is picked for the theme by this package's `render.css` and `styles.css` (`.cms-color`).
 */
export declare const color: (options?: ColorOptions) => import("@monti-cms/core").CmsPlugin<"color", ColorOptions, readonly [{
    readonly name: "color";
    readonly label: string;
    readonly syntax: {
        readonly kind: "text";
        readonly directive: "color";
    };
    readonly component: "Color";
    readonly attributes: {
        readonly fg: {
            readonly type: "string";
            readonly label: string;
        };
        readonly fgDark: {
            readonly type: "string";
            readonly label: string;
        };
        readonly bg: {
            readonly type: "string";
            readonly label: string;
        };
        readonly bgDark: {
            readonly type: "string";
            readonly label: string;
        };
    };
    readonly editor: {
        readonly view: "mark";
    };
}]> & {
    readonly contributes?: Readonly<Record<string, unknown>> | undefined;
};
