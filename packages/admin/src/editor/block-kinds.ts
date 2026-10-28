/**
 * The kinds a text block can be turned into from the block handle menu ("Turn into another block"), the kind a block is now, and the alignment of a block.
 * Pure helpers over the document, so the menu only draws what they return.
 */

import {
	Code,
	ListBulleted,
	ListChecked,
	ListNumbered,
	Paragraph,
	Quotes,
	TextAlignCenter,
	TextAlignLeft,
	TextAlignRight,
} from "@carbon/icons-react";
import type { Site } from "@monti-cms/core/site";
import { headingIcons, type MontiIcon } from "@monti-cms/ui";
import type { Editor } from "@tiptap/core";
import type { Node as PmNode } from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";
import type { TranslatorFor } from "../translator";
import { type EditorAllowance, OPEN_ALLOWANCE } from "./allowed";
import { topLevelBlockAt } from "./block-commands";
import { addedBlockOfNode } from "./blocks/added/shared";
import { targetBlockAt } from "./drag/block-resolve";
import type { editorMessages } from "./messages";

type Translator = TranslatorFor<typeof editorMessages>;

/** The kinds of the "turn into" list, in the order the menu shows them. A body keeps the kinds it holds even where the list no longer offers them. */
export type BlockKindId =
	| "paragraph"
	| "heading-2"
	| "heading-3"
	| "heading-4"
	| "bullet"
	| "ordered"
	| "todo"
	| "quote"
	| "code";

export interface BlockKind {
	id: BlockKindId;
	label: string;
	/** The Markdown that makes this kind while typing, shown at the end of the row. */
	shortcut?: string;
	icon: MontiIcon;
}

/** The kinds the menu offers for a body: headings by the allowed levels, and the blocks the allowed list lets a writer add. */
export const blockKinds = (t: Translator, allowance: EditorAllowance = OPEN_ALLOWANCE): BlockKind[] => {
	const kinds: (BlockKind & { allowed: boolean })[] = [
		{ id: "paragraph", label: t("blockKind.paragraph"), icon: Paragraph, allowed: true },
		...([2, 3, 4] as const).map((level) => ({
			id: `heading-${level}` as const,
			label: t("blockKind.heading", { level }),
			shortcut: "#".repeat(level),
			icon: headingIcons[level],
			allowed: allowance.allowsHeading(level),
		})),
		{ id: "bullet", label: t("blockKind.bullet"), shortcut: "-", icon: ListBulleted, allowed: true },
		{ id: "ordered", label: t("blockKind.ordered"), shortcut: "1.", icon: ListNumbered, allowed: true },
		{
			id: "todo",
			label: t("blockKind.todo"),
			shortcut: "[ ]",
			icon: ListChecked,
			allowed: allowance.allowsBlock("taskList"),
		},
		{
			id: "quote",
			label: t("blockKind.quote"),
			shortcut: ">",
			icon: Quotes,
			allowed: allowance.allowsBlock("blockquote"),
		},
		{
			id: "code",
			label: t("blockKind.code"),
			shortcut: "```",
			icon: Code,
			allowed: allowance.allowsBlock("codeBlock"),
		},
	];
	return kinds.filter((kind) => kind.allowed).map(({ allowed: _allowed, ...kind }) => kind);
};

const LIST_KINDS: Readonly<Record<string, BlockKindId>> = {
	bulletList: "bullet",
	orderedList: "ordered",
	taskList: "todo",
};

/** The block a handle position points to, with the node that holds it. */
const blockAt = (doc: PmNode, pos: number): { node: PmNode; start: number; parent: PmNode } | null => {
	const target = targetBlockAt(doc, pos) ?? topLevelBlockAt(doc, pos);
	if (!target) return null;
	return { node: target.node, start: target.start, parent: (target as { parent?: PmNode }).parent ?? doc };
};

/**
 * The kind of the block at `pos`, or `null` when the block is not one of the text kinds (a table, an image, a component). Turn into is offered only for a block
 * that has a kind. A heading of a level the list does not offer has a kind too (`heading-1`), so the menu can name it.
 */
export function blockKindAt(doc: PmNode, pos: number): BlockKindId | `heading-${number}` | null {
	const block = blockAt(doc, pos);
	if (!block) return null;
	const { node, parent } = block;
	switch (node.type.name) {
		case "paragraph":
			return "paragraph";
		case "heading":
			return `heading-${Number(node.attrs.level)}`;
		case "listItem":
		case "taskItem":
			return LIST_KINDS[parent.type.name] ?? null;
		case "blockquote":
			return "quote";
		case "codeBlock":
			return "code";
		default:
			return null;
	}
}

/** The name of the kind of the block at `pos`, or of the block itself when it has no kind (a table, an image, a component); `null` when nothing names it. */
export function blockNameAt(site: Site, t: Translator, doc: PmNode, pos: number): string | null {
	const kind = blockKindAt(doc, pos);
	if (kind) {
		if (kind.startsWith("heading-")) return t("blockKind.heading", { level: Number(kind.slice("heading-".length)) });
		return blockKinds(t).find((item) => item.id === kind)?.label ?? null;
	}
	const node = blockAt(doc, pos)?.node;
	if (!node) return null;
	const core: Record<string, Parameters<Translator>[0]> = {
		table: "slash.table.title",
		image: "slash.image.title",
		cmsFile: "slash.file.title",
		horizontalRule: "slash.divider.title",
	};
	const key = core[node.type.name];
	return key ? t(key) : (addedBlockOfNode(site, node.type.name)?.label ?? null);
}

/** Puts the cursor inside the block at `pos`, so the commands that follow act on that block and not on where the cursor was. */
const selectInside = (editor: Editor, pos: number) => {
	const block = blockAt(editor.state.doc, pos);
	if (!block) return null;
	const selection = TextSelection.near(
		editor.state.doc.resolve(Math.min(block.start + 1, editor.state.doc.content.size)),
	);
	return editor
		.chain()
		.focus()
		.command(({ tr }) => {
			tr.setSelection(selection);
			return true;
		});
};

/** Turns the block at `pos` into `kind`, leaving its text. A list item leaves its list, so only that block changes. */
export function turnBlockInto(editor: Editor, pos: number, kind: BlockKindId): boolean {
	const chain = selectInside(editor, pos)?.clearNodes();
	if (!chain) return false;
	switch (kind) {
		case "paragraph":
			return chain.run();
		case "heading-2":
		case "heading-3":
		case "heading-4":
			return chain.setHeading({ level: Number(kind.slice("heading-".length)) as 2 | 3 | 4 }).run();
		case "bullet":
			return chain.toggleBulletList().run();
		case "ordered":
			return chain.toggleOrderedList().run();
		case "todo":
			return chain.toggleTaskList().run();
		case "quote":
			return chain.toggleBlockquote().run();
		case "code":
			return chain.toggleCodeBlock().run();
	}
}

export type BlockAlign = "left" | "center" | "right";

export const ALIGNMENTS: readonly {
	id: BlockAlign;
	key: "align.left" | "align.center" | "align.right";
	icon: MontiIcon;
}[] = [
	{ id: "left", key: "align.left", icon: TextAlignLeft },
	{ id: "center", key: "align.center", icon: TextAlignCenter },
	{ id: "right", key: "align.right", icon: TextAlignRight },
];

/**
 * The alignment of the block at `pos`, or `null` when the block cannot be aligned. Only paragraphs and headings can, and only where the body's allowed list
 * has `text-align`. A block with no alignment set reads as left.
 */
export function blockAlignAt(
	doc: PmNode,
	pos: number,
	allowance: EditorAllowance = OPEN_ALLOWANCE,
): BlockAlign | "other" | null {
	if (!allowance.allowsBlock("text-align")) return null;
	const node = blockAt(doc, pos)?.node;
	if (!node || (node.type.name !== "paragraph" && node.type.name !== "heading")) return null;
	const align = node.attrs.textAlign;
	return align == null || align === "left" ? "left" : align === "center" || align === "right" ? align : "other";
}

/** Aligns the block at `pos`. Left clears the setting: a block with none reads as left, and the saved body stays as small as it was. */
export function alignBlock(editor: Editor, pos: number, align: BlockAlign): boolean {
	const chain = selectInside(editor, pos);
	if (!chain) return false;
	return align === "left" ? chain.unsetTextAlign().run() : chain.setTextAlign(align).run();
}
