import { definePlugin } from "@monti-cms/core";
import { validateTextPalette } from "./colors.js";
import { colorBlock } from "./definition.js";
export * from "./colors.js";
export { colorBlock } from "./definition.js";
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
export const color = (options = {}) => definePlugin({
    name: "color",
    options,
    blocks: [colorBlock],
    validate: () => validateTextPalette(options.palette),
    admin: () => import("@monti-cms/blocks/color/admin"),
    render: () => import("@monti-cms/blocks/color/render"),
});
