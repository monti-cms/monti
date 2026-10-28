import { defineBlockPlugin } from "../shared/define-block-plugin";
import { checkTextPalette } from "./colors";
import { colorBlock } from "./definition";
import { COLOR_PLUGIN, type ColorOptions } from "./options";

export * from "./colors";
export type { ColorOptions } from "./options";

/**
 * Text color and text background color (`:color[text]{fg bg …}`). Add it to the site config's `plugins`.
 *
 * ```ts
 * plugins: [color({ palette: [...] })]
 * ```
 *
 * The editor gets a `Text color` item in the format card (under ⋯). The public page is drawn by this extension's default `Color` component (`textColorProps`),
 * and the color is picked for the theme by this package's `render.css` and `styles.css` (`.monti-color`).
 */
export const color = (options: ColorOptions = {}) =>
	defineBlockPlugin({
		name: COLOR_PLUGIN.name,
		options,
		blocks: [colorBlock],
		checkConfig: () => checkTextPalette(options.palette),
		admin: () => import("@monti-cms/blocks/color/admin"),
		render: () => import("@monti-cms/blocks/color/render"),
	});
