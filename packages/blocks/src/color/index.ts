import { definePlugin } from "@monti-cms/core";
import { type PaletteColor, validateTextPalette } from "./colors";
import { colorBlock } from "./definition";

export * from "./colors";
export { colorBlock } from "./definition";

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
export const color = (options: ColorOptions = {}) =>
	definePlugin({
		name: "color",
		options,
		blocks: [colorBlock],
		validate: () => validateTextPalette(options.palette),
		admin: () => import("@monti-cms/blocks/color/admin"),
		render: () => import("@monti-cms/blocks/color/render"),
	});
