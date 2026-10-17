import type { PluginId } from "@monti-cms/core";
import type { PaletteColor } from "./colors";

export interface ColorOptions {
	/** Editor text/background color picker list. Defaults to the 8 default colors (`defaultTextPalette`). The body stores hex values. */
	readonly palette?: readonly PaletteColor[];
}

/** The color plugin with the type of its options (`site.pluginOptions(COLOR_PLUGIN)`). */
export const COLOR_PLUGIN: PluginId<"color", ColorOptions> = { name: "color" };
