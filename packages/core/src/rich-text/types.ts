import type { z } from "zod";

/** A rich-text body: the blocks in reading order. */
export interface Doc {
	blocks: Block[];
}

/** One block: `content` holds its inline nodes, `children` its child blocks, as its definition's `holds` says. */
export interface Block {
	id: string;
	type: string;
	attrs?: Record<string, unknown>;
	content?: Inline[];
	children?: Block[];
}

/** An inline node inside a block's `content`. */
export type Inline =
	| { type: "text"; text: string; marks?: Mark[] }
	| { type: "hardBreak" }
	| { type: "footnoteRef"; id: string };

/** A mark on a text node: its attributes sit flat next to `type`, e.g. `{ type: "link", href: "..." }`. */
export interface Mark {
	type: string;
	[attr: string]: unknown;
}

/** What a block holds: inline nodes in `content`, child blocks in `children`, or neither. */
export type BlockHolds = "text" | "blocks" | "nothing";

export interface BlockDefinition {
	type: string;
	holds: BlockHolds;
	/** The child block types allowed; any registered type when left out. */
	children?: readonly string[];
	/** The schema of the block's `attrs`. */
	attrs?: z.ZodTypeAny;
}

export interface MarkDefinition {
	type: string;
	/** The schema of the mark's attributes: the mark without its `type`. */
	attrs?: z.ZodTypeAny;
}

/** One problem in a body: `path` points at the value, e.g. `blocks[1].children[0].id`. */
export interface DocIssue {
	path: string;
	message: string;
}

/** Block and mark definitions added to the built-in ones; a definition with a built-in's `type` replaces it. */
export interface ValidateDocOptions {
	blocks?: readonly BlockDefinition[];
	marks?: readonly MarkDefinition[];
}
