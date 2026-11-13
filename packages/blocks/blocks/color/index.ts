import { defineMark, z } from "@monti-cms/core";
import { lazy } from "react";
import { COLORS, ColorMark } from "./site";
import { words } from "./words";

/** Text colour and background colour by name (`:color[words]{color="red"}`, doc 18). The site gives each name its light and dark shade. */
export const color = defineMark({
	type: "color",
	label: words.color,
	description: `Words in a colour (\`color\`) or on one (\`background\`), each one of: ${COLORS.join(", ")}.`,
	attrs: z
		.object({ color: z.enum(COLORS).optional(), background: z.enum(COLORS).optional() })
		.refine((value) => value.color !== undefined || value.background !== undefined, "A colour or a background"),
	fields: {
		color: { label: words.text, options: words.names },
		background: { label: words.background, options: words.names },
	},
	Site: ColorMark,
	// Its card in the format bar's ⋯, loaded in the admin the first time it opens.
	Editor: lazy(() => import("./editor")),
});
