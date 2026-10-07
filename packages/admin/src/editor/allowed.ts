import {
	type BodyAllowed,
	type BodyRules,
	bodyRules,
	bodyVocabulary,
	CORE_BODY_MARKS,
	HEADING_LEVELS,
	type Site,
} from "@monti-cms/core/client";
import { addedMarkByEditorName } from "./added-marks";
import { addedBlockOfNode } from "./blocks/added/shared";

/**
 * What the editor offers for a body, from the allowed list of the collection (`body` in the schema, read the same way by validation). The editor knows
 * Tiptap node and mark names, the list knows the names stored documents use, so this is the one place that maps one to the other.
 *
 * The list only limits what a writer can add. Every node and mark stays in the editor schema, so a body that already holds something not allowed opens,
 * shows it and saves it unchanged; what is limited is the way to **add** more: the toolbar, the slash and insert menus, input rules and shortcuts, and paste
 * (`allowed-extension.ts`).
 */
export interface EditorAllowance {
	/** The collection's list limits something. */
	readonly limited: boolean;
	readonly rules: BodyRules;
	/** A block of the list by its name (`table`, `callout`, ...). A name the list does not govern is allowed. */
	allowsBlock(name: string): boolean;
	/** A mark by its stored name (`bold`, `tooltip`, ...). */
	allowsMark(name: string): boolean;
	/** A heading level. */
	allowsHeading(level: number): boolean;
	/** A Tiptap node type by its name (`taskList`, `cmsCallout`, ...). A node the list does not govern is allowed. */
	allowsNode(name: string): boolean;
	/** A Tiptap mark type by its name (`bold`, `cmsTooltip`, ...). */
	allowsEditorMark(name: string): boolean;
	/** The name a Tiptap node has in the list, if it is governed by it. */
	blockOfNode(name: string): string | undefined;
	/** The name a Tiptap mark has in the list (the stored mark name), if it is governed by it. */
	markOfEditorMark(name: string): string | undefined;
}

/** Tiptap node names of the core blocks, by the name they have in the list. */
const CORE_NODE_BLOCKS: Readonly<Record<string, string>> = {
	table: "table",
	tableRow: "table",
	tableHeader: "table",
	tableCell: "table",
	taskList: "taskList",
	taskItem: "taskList",
	cmsMath: "math",
	image: "image",
	cmsFile: "file",
	codeBlock: "codeBlock",
	blockquote: "blockquote",
	horizontalRule: "horizontalRule",
	footnoteReference: "footnotes",
	footnoteDefinition: "footnotes",
	// The alignment attribute of paragraphs and headings (an extension with no node of its own).
	textAlign: "text-align",
};

const CORE_MARKS: ReadonlySet<string> = new Set(CORE_BODY_MARKS);

const build = (site: Site, allowed: BodyAllowed | undefined): EditorAllowance => {
	const rules = bodyRules(allowed);
	const blocks = new Set(bodyVocabulary(site).blocks);
	const blockOfNode = (name: string): string | undefined => {
		const core = CORE_NODE_BLOCKS[name];
		if (core !== undefined) return core;
		const block = addedBlockOfNode(site, name);
		return block && blocks.has(block.name) ? block.name : undefined;
	};
	const markOfEditorMark = (name: string): string | undefined =>
		CORE_MARKS.has(name) ? name : addedMarkByEditorName(site).get(name)?.name;
	return {
		limited: rules.limited,
		rules,
		allowsBlock: rules.allowsBlock,
		allowsMark: rules.allowsMark,
		allowsHeading: rules.allowsHeading,
		allowsNode: (name) => {
			if (name === "heading") return HEADING_LEVELS.some((level) => rules.allowsHeading(level));
			const block = blockOfNode(name);
			return block === undefined || rules.allowsBlock(block);
		},
		allowsEditorMark: (name) => {
			const mark = markOfEditorMark(name);
			return mark === undefined || rules.allowsMark(mark);
		},
		blockOfNode,
		markOfEditorMark,
	};
};

/** An editor with no list: everything is allowed. */
export const OPEN_ALLOWANCE: EditorAllowance = {
	limited: false,
	rules: bodyRules(undefined),
	allowsBlock: () => true,
	allowsMark: () => true,
	allowsHeading: () => true,
	allowsNode: () => true,
	allowsEditorMark: () => true,
	blockOfNode: () => undefined,
	markOfEditorMark: () => undefined,
};

const cache = new WeakMap<Site, WeakMap<BodyAllowed, EditorAllowance>>();

/**
 * What the editor offers for a body list. The same object for the same site and list, so the extensions built from it stay the same between renders.
 * Without a list, or one that limits nothing, everything is allowed.
 */
export function editorAllowance(site: Site, allowed: BodyAllowed | undefined): EditorAllowance {
	if (!allowed || !bodyRules(allowed).limited) return OPEN_ALLOWANCE;
	let bySite = cache.get(site);
	if (!bySite) {
		bySite = new WeakMap();
		cache.set(site, bySite);
	}
	let allowance = bySite.get(allowed);
	if (!allowance) {
		allowance = build(site, allowed);
		bySite.set(allowed, allowance);
	}
	return allowance;
}
