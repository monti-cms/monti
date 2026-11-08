import { z } from "zod";
import { sameJson } from "../json";
import type { Message } from "../operation";
import type { AdminValues } from "../schema/admin-values";
import { type Block, blockMap, type Doc, DocShape, walk } from "./doc";

/** A row a block adds to the publish to-do list. `block` stops the publish; `warn` only tells. */
export type BlockCheck = { level: "warn" | "block"; message: string | Message };

/**
 * A kind of block, defined once: the editor, the "/" menu, the site, the assistant's catalog and the publish check all come from it (doc 03,
 * principle 3). `Component` is the site's component type (a React component for a React site); core never calls it except through `renderDocument`.
 */
export type BlockDefinition<Component = unknown> = {
	/** `paragraph`, `callout`, `component:PostCard`. */
	type: string;
	/** What the "/" menu shows: the site's own words, or a message key (the core's blocks). */
	label: string | Message;
	/** For the model: when to use the block. */
	description: string;
	/** The "/" menu group. Blocks without one are not offered there (a list item comes with its list). */
	menu?: "text" | "insert" | "component";
	attrs?: z.ZodType<Record<string, unknown>>;
	holds: "text" | "blocks" | "nothing";
	/** For a block that holds blocks: the types it takes. All when left out. */
	children?: string[];
	/**
	 * What a translation rewrites (doc 04): the block's text, unless `text` is false (code), and the attrs named here (a caption, a table's cells). A block
	 * with nothing to rewrite follows the source block in a translation.
	 */
	translate?: { attrs?: string[]; text?: false };
	Site?: Component;
	/** The editor's view; the site's component with editable children when left out. */
	Editor?: Component;
	check?: (block: Block) => BlockCheck[];
};

export type AnyBlockDefinition = BlockDefinition<unknown>;

export function defineBlock<Component>(definition: BlockDefinition<Component>): BlockDefinition<Component> {
	if (!/^[a-zA-Z][\w:-]*$/.test(definition.type)) throw new Error(`Block type "${definition.type}" is not a name.`);
	return definition;
}

export type MarkDefinition<Component = unknown> = {
	type: string;
	label: string | Message;
	attrs?: z.ZodType<Record<string, unknown>>;
	Site?: Component;
};

export function defineMark<Component>(definition: MarkDefinition<Component>): MarkDefinition<Component> {
	return definition;
}

/** A core block's label: a key of the admin's message dictionaries. */
const label = (type: string): Message => ({ key: `blocks.${type}` });

const text = (type: string, description: string, extra: Partial<AnyBlockDefinition> = {}) =>
	defineBlock({ type, label: label(type), description, holds: "text", menu: "text", ...extra });

/** The blocks a blog post needs, and nothing more (doc 03, "which block lives where"). */
/** Where a paragraph's or a heading's lines sit; left when left out (the block menu's "align", doc 03). */
const align = z.enum(["left", "center", "right"]).optional();

export const coreBlocks: AnyBlockDefinition[] = [
	text("paragraph", "A paragraph of text, aligned left unless `align` says center or right.", {
		attrs: z.object({ align }),
	}),
	text("heading", "A section heading, level 2 to 4, aligned left unless `align` says center or right.", {
		attrs: z.object({ level: z.number().int().min(2).max(4), align }),
	}),
	defineBlock({
		type: "bulletList",
		label: label("bulletList"),
		description: "A bulleted list. Its children are listItem blocks.",
		menu: "text",
		holds: "blocks",
		children: ["listItem"],
	}),
	defineBlock({
		type: "orderedList",
		label: label("orderedList"),
		description: "A numbered list. Its children are listItem blocks.",
		menu: "text",
		attrs: z.object({ start: z.number().int().min(0).optional() }),
		holds: "blocks",
		children: ["listItem"],
	}),
	defineBlock({
		type: "checklist",
		label: label("checklist"),
		description: "A list of items to tick. Its children are listItem blocks with `checked`.",
		menu: "text",
		holds: "blocks",
		children: ["listItem"],
	}),
	defineBlock({
		type: "listItem",
		label: label("listItem"),
		description: "One item of a list.",
		attrs: z.object({ checked: z.boolean().optional() }),
		holds: "text",
	}),
	defineBlock({ type: "quote", label: label("quote"), description: "A quotation.", menu: "text", holds: "blocks" }),
	text("codeBlock", "Code, kept as written, with its language.", {
		attrs: z.object({ language: z.string().optional() }),
		translate: { text: false },
	}),
	defineBlock({
		type: "table",
		label: label("table"),
		description:
			"A table of plain text cells; the first row is the header when `header` is true. `widths`, when set, is each column's share of the body in percent.",
		menu: "text",
		attrs: z.object({
			header: z.boolean().optional(),
			rows: z.array(z.array(z.string())),
			widths: z.array(z.number().positive().max(100)).optional(),
		}),
		holds: "nothing",
		translate: { attrs: ["rows"] },
	}),
	defineBlock({
		type: "divider",
		label: label("divider"),
		description: "A horizontal rule.",
		menu: "text",
		holds: "nothing",
	}),
	text("footnote", "A footnote's text; footnoteRef inlines with the same id point at it.", {
		attrs: z.object({ id: z.string() }),
	}),
	defineBlock({
		type: "image",
		label: label("image"),
		description: "An image from the media library, with alt text and an optional caption.",
		menu: "insert",
		attrs: z.object({
			media: z.string(),
			alt: z.string().optional(),
			caption: z.string().optional(),
			/** Left empty on purpose: the site draws an empty alt, and no publish check asks for one (doc 09). */
			decorative: z.boolean().optional(),
			width: z.number().positive().nullable().optional(),
			align: z.enum(["left", "center", "right"]).optional(),
			/** What of the picture shows, as parts of it. The original is never changed. */
			crop: z
				.object({
					x: z.number().min(0).max(1),
					y: z.number().min(0).max(1),
					width: z.number().positive().max(1),
					height: z.number().positive().max(1),
				})
				.optional(),
			rotate: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]).optional(),
		}),
		holds: "nothing",
		translate: { attrs: ["alt", "caption"] },
	}),
	defineBlock({
		type: "file",
		label: label("file"),
		description: "A file from the media library to download.",
		menu: "insert",
		attrs: z.object({ media: z.string(), name: z.string().optional() }),
		holds: "nothing",
	}),
];

export const coreMarks: MarkDefinition[] = [
	defineMark({ type: "bold", label: { key: "marks.bold" } }),
	defineMark({ type: "italic", label: { key: "marks.italic" } }),
	defineMark({ type: "underline", label: { key: "marks.underline" } }),
	defineMark({ type: "strike", label: { key: "marks.strike" } }),
	defineMark({ type: "code", label: { key: "marks.code" } }),
	defineMark({ type: "sup", label: { key: "marks.sup" } }),
	defineMark({ type: "sub", label: { key: "marks.sub" } }),
	defineMark({ type: "link", label: { key: "marks.link" }, attrs: z.object({ href: z.string().min(1) }) }),
];

/** The blocks and marks a site has: the core's, the site's and its plugins'. */
export type BlockKit = {
	blocks: ReadonlyMap<string, AnyBlockDefinition>;
	marks: ReadonlyMap<string, MarkDefinition>;
};

export function createBlockKit(blocks: AnyBlockDefinition[], marks: MarkDefinition[]): BlockKit {
	const byType = <T extends { type: string }>(list: T[], what: string) => {
		const map = new Map<string, T>();
		for (const each of list) {
			if (map.has(each.type)) throw new Error(`${what} "${each.type}" is defined twice.`);
			map.set(each.type, each);
		}
		return map;
	};
	return { blocks: byType([...coreBlocks, ...blocks], "Block"), marks: byType([...coreMarks, ...marks], "Mark") };
}

type Editor = NonNullable<AdminValues["editor"]>;
const allows = (list: "all" | string[] | undefined, type: string) =>
	list === undefined || list === "all" || list.includes(type);

/** Whether the editor of a collection offers the block (its editor allowance, doc 01). */
export const blockOn = (editor: Editor | undefined, block: Pick<Block, "type" | "attrs">) =>
	allows(editor?.blocks, block.type) &&
	(block.type !== "heading" || !editor?.headings || editor.headings.includes(Number(block.attrs?.level)));
export const markOn = (editor: Editor | undefined, type: string) => allows(editor?.marks, type);

export type BodyProblem = { code: string; block?: string; detail?: string };

/**
 * What a body must fix before it is saved. A person's save and the assistant's block operations both pass it (doc 03). Blocks the doc already had
 * may stay as they are, even of a type the site no longer defines (doc 03, decisions); a new block may not. The editor allowance is not checked
 * here: it only filters the "/" menu and the assistant's catalog, so a template put in the editor goes in as it is.
 */
export function checkDoc(doc: unknown, kit: BlockKit, previous: Doc | null): BodyProblem[] {
	const parsed = DocShape.safeParse(doc);
	if (!parsed.success) return [{ code: "shape", detail: parsed.error.issues[0]?.message }];
	const before = blockMap(previous);
	const problems: BodyProblem[] = [];
	const seen = new Set<string>();
	for (const { block } of walk(parsed.data.blocks)) {
		const at = (code: string, detail?: string) =>
			problems.push({ code, block: block.id, ...(detail ? { detail } : {}) });
		if (seen.has(block.id)) at("duplicateId");
		seen.add(block.id);
		const old = before.get(block.id);
		if (old !== undefined && sameJson(old, block)) continue;
		const definition = kit.blocks.get(block.type);
		if (!definition) {
			if (old?.type !== block.type) at("unknownBlock", block.type);
			continue;
		}
		if (definition.holds !== "text" && block.content?.length) at("noText");
		if (definition.holds !== "blocks" && block.children?.length) at("noChildren");
		if (definition.children && block.children?.some((child) => !definition.children?.includes(child.type)))
			at("badChild");
		const attrs = (definition.attrs ?? z.object({}).strict()).safeParse(block.attrs ?? {});
		if (!attrs.success) at("badAttrs", attrs.error.issues[0]?.message);
		// A mark the block already had may stay, like a block, even when the site no longer defines it.
		const oldMarks = new Set(
			(old?.content ?? [])
				.flatMap((inline) => (inline.type === "text" ? (inline.marks ?? []) : []))
				.map((mark) => mark.type),
		);
		for (const inline of block.content ?? [])
			for (const mark of inline.type === "text" ? (inline.marks ?? []) : []) {
				const markDefinition = kit.marks.get(mark.type);
				if (!markDefinition) {
					if (!oldMarks.has(mark.type)) at("unknownMark", mark.type);
					continue;
				}
				const { type: _type, ...markAttrs } = mark;
				if (!(markDefinition.attrs ?? z.object({}).strict()).safeParse(markAttrs).success) at("badMark", mark.type);
			}
	}
	return problems;
}
