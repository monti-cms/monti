import type { Block, Doc } from "@monti-cms/core";
import {
	Command,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	MenuShortcut,
	Popover,
	PopoverContent,
	Text,
} from "@monti-cms/ui";
import type { Node as EditorNode } from "@tiptap/pm/model";
import { TextSelection, type Transaction } from "@tiptap/pm/state";
import type { Editor } from "@tiptap/react";
import { type ReactNode, useCallback, useMemo, useRef, useState } from "react";
import { useAdmin } from "../operations/admin-context";
import { useOperation, useRead } from "../operations/use-operation";
import { BlockIcon } from "./block-icon";
import { type BodyCatalogs, needsAttrs } from "./catalog";
import { insertBlocks, inTableCell, KIND_SHORTCUTS, type Kind, kindKey, offeredKinds, turnInto } from "./commands";
import { docToEditor } from "./convert";
import { insertFootnote } from "./footnotes";
import { nodeName } from "./schema";
import { tableToEditor } from "./table";

type Group = "text" | "insert" | "component" | "templates";
const GROUPS: Group[] = ["text", "insert", "component", "templates"];

type Item = {
	key: string;
	group: Group;
	label: string;
	/** Words it is found by besides its label: its block type, its markdown. */
	words: string[];
	/** The mark at the start of its row. */
	icon: ReactNode;
	/** The markdown that makes it when typed at the start of a line, shown at the end of its row. */
	typed?: string;
	/** Puts the block in on the line the "/" was typed on. */
	run: (editor: Editor) => void | Promise<void>;
};

type Open = { from: number; to: number; query: string; caret: { top: number; bottom: number; left: number } };

/**
 * Blocks that need their own feature before the menu can put them in: an image and a file come from the media library (doc 09).
 */
const NOT_FROM_MENU = new Set(["image", "file"]);

/** A new table: three columns, a head row and two rows under it, all empty. */
const NEW_TABLE: Block = {
	id: "",
	type: "table",
	attrs: { header: true, rows: Array.from({ length: 3 }, () => ["", "", ""]) },
};

/** Puts a new table in the line's place and the caret in its first cell. */
const placeTable = (editor: Editor) => (tr: Transaction) => {
	placeBefore(editor.schema.nodeFromJSON(tableToEditor(NEW_TABLE, null)))(tr);
	let cell: number | null = null;
	tr.doc.descendants((node, pos) => {
		if (cell !== null) return false;
		// The table just put in is the one without an id yet.
		if (node.type.name === "table" && !node.attrs.blockId) cell = pos + 3;
		return node.type.name !== "table";
	});
	if (cell !== null) tr.setSelection(TextSelection.create(tr.doc, cell));
};

/** The line the "/" is on, made empty: a text kind turns it; anything else goes in its place, and that line stays under it for writing on. */
function putIn(editor: Editor, open: Open, make: (tr: Transaction) => void) {
	const tr = editor.state.tr.delete(open.from, open.to);
	make(tr);
	editor.view.dispatch(tr.scrollIntoView());
	editor.commands.focus();
}

const turnLine = (kind: Kind) => (tr: Transaction) => {
	const { $from } = tr.selection;
	if ($from.parent.content.size === 0) turnInto(tr, $from.before(), kind);
	else {
		const at = $from.after();
		tr.insert(at, tr.doc.type.schema.nodes.paragraph.create());
		tr.setSelection(TextSelection.create(tr.doc, at + 1));
		turnInto(tr, at, kind);
	}
};

const placeBefore = (node: EditorNode) => (tr: Transaction) => {
	const { $from } = tr.selection;
	if ($from.parent.content.size === 0) tr.insert($from.before(), node);
	else insertBlocks(tr, [node]);
};

/**
 * The "/" menu (doc 03, menu.md): one level, under the "/" typed at the start of a line, the focus kept in the text (arrows, Enter and Esc work from
 * there). Its groups are the text blocks, the blocks to insert, the site's components and the templates; typing the word for templates leaves the templates only.
 * Only what the collection's editor offers is in it.
 */
export function useSlashMenu({
	catalogs,
	templates,
	editorRef,
}: {
	catalogs: BodyCatalogs;
	/** The templates group; off where a template itself is written. */
	templates: boolean;
	editorRef: { current: Editor | null };
}) {
	const { t } = useAdmin();
	const [open, setOpen] = useState<Open | null>(null);
	const [index, setIndex] = useState(0);
	const dismissed = useRef<number | null>(null);
	const list = useRead<{ id: string; name: string }[]>("templates.list", {});
	const get = useOperation<{ doc: Doc }>("templates.get");

	const items = useMemo<Item[]>(() => {
		const { kit, offered } = catalogs;
		const label = (type: string) => {
			const block = kit.blocks.find((each) => each.type === type);
			return block ? t(block.label) : type;
		};
		const text: Item[] = offeredKinds(offered).map((kind) => ({
			key: kindKey(kind),
			group: "text",
			label: kind.type === "heading" ? t("editor.heading", { level: kind.level }) : label(kind.type),
			words: [kind.type, KIND_SHORTCUTS[kindKey(kind)] ?? ""],
			icon: <BlockIcon type={kind.type} level={kind.type === "heading" ? kind.level : undefined} />,
			typed: KIND_SHORTCUTS[kindKey(kind)] || undefined,
			run: (editor) => {
				if (open) putIn(editor, open, turnLine(kind));
			},
		}));
		const others: Item[] = offered.blocks
			.filter(
				(block) =>
					block.menu !== null &&
					!NOT_FROM_MENU.has(block.type) &&
					(block.type === "table" || block.type === "footnote" || !needsAttrs(block)) &&
					!["paragraph", "heading", "bulletList", "orderedList", "checklist", "quote", "codeBlock"].includes(
						block.type,
					),
			)
			.map((block) => ({
				key: block.type,
				group: block.type === "divider" ? "text" : block.menu === "component" ? "component" : "insert",
				label: t(block.label),
				words: [block.type, block.type === "divider" ? "---" : ""],
				icon: <BlockIcon type={block.type} />,
				typed: block.type === "divider" ? "---" : undefined,
				run: (editor) => {
					if (!open) return;
					if (block.type === "table") return putIn(editor, open, placeTable(editor));
					// A footnote: its number where the "/" was, its text at the end of the body.
					if (block.type === "footnote") return putIn(editor, open, (tr) => insertFootnote(tr, tr.selection.from));
					const type = editor.schema.nodes[nodeName(block.type)];
					if (!type) return;
					const node = type.createAndFill() ?? type.create();
					putIn(editor, open, block.holds === "nothing" ? placeBefore(node) : (tr) => insertBlocks(tr, [node]));
				},
			}));
		const shown = templates
			? (list.data ?? []).map<Item>((template) => ({
					key: `template:${template.id}`,
					group: "templates",
					label: template.name,
					words: [t("slash.templateWord")],
					icon: <BlockIcon type="template" />,
					run: async (editor) => {
						if (!open) return;
						const answer = await get.run({ id: template.id });
						if (!answer.ok) return;
						const json = docToEditor(answer.body.doc, catalogs.kit, { fresh: true });
						const nodes = (json.content ?? []).map((node) => editor.schema.nodeFromJSON(node));
						putIn(editor, open, (tr) => insertBlocks(tr, nodes));
					},
				}))
			: [];
		return [...text, ...others, ...shown];
	}, [catalogs, templates, list.data, t, open, get]);

	const shownItems = useMemo(() => {
		if (!open) return [];
		const query = open.query.toLowerCase();
		if (query === "") return items;
		const word = t("slash.templateWord").toLowerCase();
		if (word.startsWith(query) && query.length >= 2) return items.filter((item) => item.group === "templates");
		return items.filter(
			(item) =>
				item.label.toLowerCase().includes(query) || item.words.some((each) => each.toLowerCase().startsWith(query)),
		);
	}, [items, open, t]);

	/** Opens the menu while the text before the cursor in its line is "/" and a word; closes it otherwise. */
	const sync = useCallback((editor: Editor) => {
		const { selection } = editor.state;
		const { $from } = selection;
		const text = $from.parent.isTextblock ? $from.parent.textBetween(0, $from.parentOffset, "\n", "\0") : "";
		const match =
			selection.empty &&
			$from.parent.type.name !== nodeName("codeBlock") &&
			$from.parent.type.name !== nodeName("footnote") &&
			!inTableCell($from)
				? /^\/([^\s/]*)$/.exec(text)
				: null;
		if (!match) {
			dismissed.current = null;
			setOpen(null);
			return;
		}
		const from = $from.start();
		if (dismissed.current === from) return;
		const caret = editor.view.coordsAtPos($from.pos);
		setOpen((current) => {
			if (current?.query !== match[1]) setIndex(0);
			return { from, to: $from.pos, query: match[1] ?? "", caret };
		});
	}, []);

	const choose = useCallback(
		(item: Item | undefined) => {
			const editor = editorRef.current;
			setOpen(null);
			if (item && editor) void item.run(editor);
		},
		[editorRef],
	);

	/** The menu's keys, while it is open; `false` lets the text have the key. */
	const keyDown = useCallback(
		(event: KeyboardEvent) => {
			if (!open || shownItems.length === 0) return false;
			if (event.key === "ArrowDown" || event.key === "ArrowUp") {
				const step = event.key === "ArrowDown" ? 1 : -1;
				setIndex((current) => (current + step + shownItems.length) % shownItems.length);
				return true;
			}
			if (event.key === "Enter") {
				choose(shownItems[index]);
				return true;
			}
			if (event.key === "Escape") {
				dismissed.current = open.from;
				setOpen(null);
				return true;
			}
			return false;
		},
		[open, shownItems, index, choose],
	);

	const menu =
		open && shownItems.length > 0 ? (
			<SlashMenu
				items={shownItems}
				query={open.query}
				caret={open.caret}
				index={index}
				onHighlight={setIndex}
				onChoose={choose}
				onClose={() => {
					dismissed.current = open.from;
					setOpen(null);
				}}
			/>
		) : null;
	return { sync, keyDown, menu };
}

function SlashMenu({
	items,
	query,
	caret,
	index,
	onHighlight,
	onChoose,
	onClose,
}: {
	items: Item[];
	query: string;
	caret: Open["caret"];
	index: number;
	onHighlight: (index: number) => void;
	onChoose: (item: Item) => void;
	onClose: () => void;
}) {
	const { t } = useAdmin();
	const anchor = useMemo(
		() => ({ getBoundingClientRect: () => new DOMRect(caret.left, caret.top, 1, caret.bottom - caret.top) }),
		[caret],
	);
	const titles: Record<Group, string> = {
		text: t("slash.text"),
		insert: t("slash.insert"),
		component: t("slash.component"),
		templates: t("slash.templates"),
	};
	return (
		<Popover open onOpenChange={(next) => !next && onClose()}>
			<PopoverContent
				anchor={anchor}
				side="bottom"
				align="start"
				padding="menu"
				width="sm"
				initialFocus={false}
				finalFocus={false}
				// Pressing a row keeps the focus in the text.
				onMouseDown={(event) => event.preventDefault()}
			>
				<Command shouldFilter={false} value={String(index)} onValueChange={(value) => onHighlight(Number(value))}>
					<CommandInput value={query} readOnly placeholder={t("slash.find")} aria-label={t("slash.find")} />
					<CommandList aria-label={t("slash.label")}>
						{GROUPS.map((group) => {
							const rows = items.flatMap((item, at) => (item.group === group ? [{ item, at }] : []));
							if (rows.length === 0) return null;
							return (
								<CommandGroup key={group} heading={titles[group]}>
									{rows.map(({ item, at }) => (
										<CommandItem key={item.key} value={String(at)} onSelect={() => onChoose(item)}>
											{item.icon}
											<Text truncate>{item.label}</Text>
											{item.typed ? <MenuShortcut typed>{item.typed}</MenuShortcut> : null}
										</CommandItem>
									))}
								</CommandGroup>
							);
						})}
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}
