import { defineBlockPlugin } from "../shared/define-block-plugin.js";
import { checkTextPalette } from "./colors.js";
import { colorBlock } from "./definition.js";
import { COLOR_PLUGIN } from "./options.js";
export * from "./colors.js";
/**
 * Text color and text background color (`:color[text]{fg bg …}`). Add it to the site config's `plugins`.
 *
 * ```ts
 * plugins: [color({ palette: [...] })]
 * ```
 *
 * The editor gets a `Text color` item in the format toolbar and text bubble. The public page is drawn by this extension's default `Color` component (`textColorProps`),
 * and the color is picked for the theme by this package's `render.css` and `styles.css` (`.monti-color`).
 */
export const color = (options = {}) => defineBlockPlugin({
    name: COLOR_PLUGIN.name,
    options,
    blocks: [colorBlock],
    checkConfig: () => checkTextPalette(options.palette),
    admin: () => import("@monti-cms/blocks/color/admin"),
    render: () => import("@monti-cms/blocks/color/render"),
});
