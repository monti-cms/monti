/**
 * What a design tool's drawing says, before it is a screen spec: the tree a board converter's adapter reads out of one tool (an HTML board today; a
 * Figma file or a PDF would each get an adapter of their own) and hands to `toSpec`. It holds what is placed where and how far apart, never a class or a
 * style of the tool, so everything after the adapter is the same for every tool.
 */
export interface DrawnNode {
	/** Where the adapter found it, for a person to look up in the drawing ("form › div.field[1]"). */
	readonly where: string;
	/** The design system part the drawing names (by the tool's own marking: a DS class, a component name). Absent for a plain group or a text. */
	readonly part?: string;
	readonly props?: Readonly<Record<string, string | number | boolean>>;
	/** The drawing's own name for the element, when another one names it (a field a label is for). Never in the spec: it becomes a reference. */
	readonly id?: string;
	/** A run of text, as drawn. */
	readonly text?: string;
	/** A plain group: the axis its children run along. */
	readonly direction?: "column" | "row";
	/** A plain group: the screen's own layout of it (open to the screen, written on its Stack). */
	readonly layout?: {
		readonly align?: "start" | "center" | "end" | "baseline" | "stretch";
		readonly justify?: "start" | "center" | "end" | "between";
		readonly grow?: boolean;
		readonly maxWidth?: number;
		readonly minHeight?: "screen";
	};
	readonly children?: readonly DrawnNode[];
	/** In a group, the distance in px from the child before it (for the first child, from the group's start). */
	readonly before?: number;
	/** In a group, the distance in px from its last child to the group's end. */
	readonly after?: number;
	/** What the drawing shapes by hand on it instead of through the design system ("max-width: var(--width-side-panel)", "class my-look"). */
	readonly looks?: readonly string[];
}
