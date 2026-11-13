import { Information } from "@monti-cms/admin/icons";
import { defineBlock, z } from "@monti-cms/core";
import { lazy } from "react";
import { Callout, TONES } from "./site";
import { words } from "./words";

/** A callout (`:::callout{tone="warning" title="…"}`): a box that sets a note, a tip or a warning apart (doc 18). */
export const callout = defineBlock({
	type: "callout",
	label: words.callout,
	description:
		"A highlighted box for a note, a tip, information, a warning or a danger (`tone`, a note when left out), with an optional `title`; without one it is titled by its tone. It holds blocks.",
	menu: "insert",
	attrs: z.object({ tone: z.enum(TONES).optional(), title: z.string().optional() }),
	fields: {
		tone: {
			label: words.kind,
			options: words.tones,
		},
		title: {
			label: words.title,
		},
	},
	holds: "blocks",
	translate: { attrs: ["title"] },
	Site: Callout,
	// The editor's view (its own tool row and settings), loaded in the admin the first time it is drawn.
	Editor: lazy(() => import("./editor")),
	Icon: Information,
});
