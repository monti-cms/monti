import { z } from "zod";
import { base64url, randomBytes } from "../bytes";

/** A text mark. Core has bold, italic, underline, strike, code, sup, sub and link; plugins add more (`defineMark`). */
export type Mark = { type: string; [attr: string]: unknown };

export type Inline =
	| { type: "text"; text: string; marks?: Mark[] }
	| { type: "hardBreak" }
	| { type: "footnoteRef"; id: string };

/** One block of a body. Its id is set when it is first made and never changes (doc 03, principle 2). */
export type Block = {
	id: string;
	type: string;
	attrs?: Record<string, unknown>;
	/** For blocks that hold text. */
	content?: Inline[];
	/** For blocks that hold blocks (a quote, a list). */
	children?: Block[];
};

/** A body: the JSON document that is always what is stored. MDX and other syntaxes are a plugin's import and export (doc 03, principle 1). */
export type Doc = { type: "doc"; blocks: Block[] };

const MarkShape = z.looseObject({ type: z.string() });
export const InlineShape = z.discriminatedUnion("type", [
	z.object({ type: z.literal("text"), text: z.string(), marks: z.array(MarkShape).optional() }),
	z.object({ type: z.literal("hardBreak") }),
	z.object({ type: z.literal("footnoteRef"), id: z.string() }),
]);
export const BlockShape: z.ZodType<Block> = z.lazy(() =>
	z.object({
		id: z.string().min(1),
		type: z.string().min(1),
		attrs: z.record(z.string(), z.unknown()).optional(),
		content: z.array(InlineShape).optional(),
		children: z.array(BlockShape).optional(),
	}),
);
export const DocShape: z.ZodType<Doc> = z.object({ type: z.literal("doc"), blocks: z.array(BlockShape) });

/** A block as an operation gives it: ids are made for blocks that have none. */
export type NewBlock = Omit<Block, "id" | "children"> & { id?: string; children?: NewBlock[] };
export const NewBlockShape: z.ZodType<NewBlock> = z.lazy(() =>
	z.object({
		id: z.string().min(1).optional(),
		type: z.string().min(1),
		attrs: z.record(z.string(), z.unknown()).optional(),
		content: z.array(InlineShape).optional(),
		children: z.array(NewBlockShape).optional(),
	}),
);

export const newBlockId = () => `b_${base64url(randomBytes(6))}`;

/** Gives every block without an id a new one. */
export const withIds = ({ children, ...block }: NewBlock): Block => ({
	...block,
	id: block.id ?? newBlockId(),
	...(children ? { children: children.map(withIds) } : {}),
});

/** A copy with every id new: a template put into an entry, a duplicated block (doc 03, decisions). */
export const withNewIds = (block: Block): Block => ({
	...block,
	id: newBlockId(),
	...(block.children ? { children: block.children.map(withNewIds) } : {}),
});

/** Every block, depth first, with the list it sits in. */
export function* walk(blocks: Block[]): Generator<{ block: Block; siblings: Block[] }> {
	for (const block of blocks) {
		yield { block, siblings: blocks };
		if (block.children) yield* walk(block.children);
	}
}

export const blockMap = (doc: Doc | null) =>
	new Map(doc ? [...walk(doc.blocks)].map(({ block }) => [block.id, block]) : []);

/** A block's text as one string: the offsets `replaceText` counts in. A hard break is one `\n`; a footnote reference takes no place. */
export const plainText = (content: Inline[] = []) =>
	content.map((inline) => (inline.type === "text" ? inline.text : inline.type === "hardBreak" ? "\n" : "")).join("");

export const emptyDoc = (): Doc => ({ type: "doc", blocks: [] });

/** A stored body; an entry without one has an empty doc. */
export const asDoc = (value: unknown): Doc => (value === null || value === undefined ? emptyDoc() : (value as Doc));
