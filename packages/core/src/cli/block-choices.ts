/** The blocks and inline marks of `@monti-cms/blocks` that `monti init` offers, and the choices made among them. */

/** A body block or inline mark of `@monti-cms/blocks`, as `monti init` offers it. */
export interface BlockChoice {
	/** The name used in flags (`--blocks callout,tabs`). */
	readonly id: string;
	/** The function listed in `plugins`: exported by `@monti-cms/blocks`, or by `@monti-cms/blocks/<id>` for a block with a `needs` (the heavy ones, so the barrel never loads their library). */
	readonly fn: string;
	/** One line for the list and for the comment in the config. */
	readonly description: string;
	/** An npm package the block needs besides `@monti-cms/blocks`. */
	readonly needs?: string;
	/** Why the block is not in the default set: what it adds to the app. Set only for blocks that are opt-in. */
	readonly heavy?: string;
}

/** Every block of `@monti-cms/blocks`, in the order the plugins are listed (the inline marks last: overlapping marks are stored in this order). */
export const BLOCK_CHOICES: readonly BlockChoice[] = [
	{ id: "callout", fn: "callout", description: "note, tip and warning boxes" },
	{ id: "collapsible", fn: "collapsible", description: "a section that opens and closes" },
	{ id: "tabs", fn: "tabs", description: "content split into tabs" },
	{ id: "columns", fn: "columns", description: "side-by-side columns" },
	{ id: "code-explorer", fn: "codeExplorer", description: "code with a file tree and several files" },
	{
		id: "mermaid",
		fn: "mermaid",
		description: "diagrams written in Mermaid",
		needs: "mermaid",
		heavy: "the mermaid package alone is about 26 MB in node_modules and loads a large script in the browser",
	},
	{
		id: "chart",
		fn: "chart",
		description: "bar, line and pie charts",
		needs: "recharts",
		heavy: "it adds recharts and its dependencies (d3), which is a large script for the pages that show a chart",
	},
	{ id: "tooltip", fn: "tooltip", description: "inline text with a hover explanation" },
	{ id: "code-ref", fn: "codeRef", description: "inline link from a phrase to a line of code" },
	{ id: "color", fn: "color", description: "inline text color" },
];

/**
 * The blocks `monti init` turns on when nobody chose: the light ones. The heavy ones (`mermaid`, `chart`) are opt-in (`--blocks all` or a list that names them),
 * because each adds a large package to the app. `columns`, `code-explorer` and `tooltip` are also left out: they are small, but a first blog rarely needs them.
 */
export const DEFAULT_BLOCK_IDS: readonly string[] = ["callout", "collapsible", "tabs", "code-ref", "color"];

/** The module a block's function is imported from. */
export const blockEntry = (block: BlockChoice): string =>
	block.needs ? `@monti-cms/blocks/${block.id}` : "@monti-cms/blocks";

/** The block choices for the ids, in the order of {@link BLOCK_CHOICES}. */
export const chosenBlocks = (ids: readonly string[]): readonly BlockChoice[] =>
	BLOCK_CHOICES.filter((block) => ids.includes(block.id));
