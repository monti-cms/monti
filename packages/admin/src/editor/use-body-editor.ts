import type { Doc } from "@monti-cms/core";
import { Dropcursor, Gapcursor, UndoRedo } from "@tiptap/extensions";
import { GapCursor } from "@tiptap/pm/gapcursor";
import type { Node as EditorNode } from "@tiptap/pm/model";
import { NodeSelection } from "@tiptap/pm/state";
import { type Editor, type ReactNodeViewProps, useEditor } from "@tiptap/react";
import { type ComponentType, useMemo, useRef } from "react";
import { useAdmin } from "../operations/admin-context";
import { useRead } from "../operations/use-operation";
import type { BodyCatalogs, Catalog, CatalogBlock } from "./catalog";
import { CodeTools } from "./code/code-state";
import { CodeBlockView } from "./code/code-view";
import { docFromEditor, docToEditor } from "./convert";
import { Footnotes } from "./footnotes";
import { bodyKeys } from "./keys";
import { MEDIA_VIEWS } from "./media-views";
import { BlockIds, bodyStates } from "./plugins";
import { ProposalMarks } from "./proposal-marks";
import { nothingPicked, RangeOverWholeBlocks } from "./range-over-blocks";
import { RequestMarks } from "./request-marks";
import { bodyExtensions, nodeName } from "./schema";

/** How the core's own blocks draw in the editor: a picture, a file, a code block (doc 17). */
const VIEWS = new Map<string, ComponentType<ReactNodeViewProps>>([...MEDIA_VIEWS, ["codeBlock", CodeBlockView]]);

/** The site's blocks and the ones a collection's editor offers (`blocks.catalog`, doc 03). A template is written with every block the site has. */
export function useBodyCatalogs(collection?: string): BodyCatalogs | null {
	const kit = useRead<Catalog>("blocks.catalog", {});
	const offered = useRead<Catalog>("blocks.catalog", collection ? { collection } : {});
	if (!kit.data || !offered.data) return null;
	return { kit: kit.data, offered: collection ? offered.data : kit.data };
}

/**
 * The body's editor engine (doc 03): its schema made from the site's blocks, the stored body put in with its block ids, and every change handed back
 * as a stored body. `keyDown` sees each key first (the "/" menu takes the arrows and Enter while it is open). The editor is made once per catalog; to
 * show another body, mount it again with a new `key`.
 */
export function useBodyEditor({
	doc,
	catalogs,
	editable = true,
	onChange,
	keyDown,
	onSelection,
	onFiles,
	onTakeProposal,
}: {
	doc: Doc;
	catalogs: BodyCatalogs;
	editable?: boolean;
	onChange: (doc: Doc) => void;
	keyDown?: (event: KeyboardEvent) => boolean;
	onSelection?: (editor: Editor) => void;
	/** Files pasted or dropped in the text, and where (doc 09): `true` when they were taken. */
	onFiles?: (files: File[], at: number | null, editor: Editor) => boolean;
	/** The person started changing a block a body proposal touches: the proposal is taken first. */
	onTakeProposal?: (id: string) => void;
}) {
	const { t, blocks } = useAdmin();
	const { kit, offered } = catalogs;
	const latest = useRef({ t, offered, onChange, keyDown, onSelection, onTakeProposal, onFiles });
	latest.current = { t, offered, onChange, keyDown, onSelection, onTakeProposal, onFiles };
	const made = useRef<Editor | null>(null);

	const extensions = useMemo(() => {
		const byName = new Map(kit.blocks.map((block) => [nodeName(block.type), block]));
		const boxLabel = (block: CatalogBlock) => {
			const known = kit.blocks.find((each) => each.type === block.type);
			return known ? latest.current.t(known.label) : latest.current.t("editor.unknownBlock", { type: block.type });
		};
		/** Whether the collection's editor offers a block: its type, and for a heading its level (doc 01, the editor allowance). */
		const isOffered = (node: EditorNode) => {
			const block = byName.get(node.type.name);
			if (!block) return true;
			const { offered: now } = latest.current;
			if (!now.blocks.some((each) => each.type === block.type)) return false;
			return block.type !== "heading" || now.headings.includes(Number(node.attrs.data?.level ?? 2));
		};
		return [
			...bodyExtensions(kit, boxLabel, blocks, VIEWS),
			CodeTools.configure({ settings: kit.code ?? null }),
			BlockIds,
			bodyStates({
				labels: () => ({ placeholder: latest.current.t("editor.placeholder"), off: latest.current.t("editor.off") }),
				offered: () => isOffered,
			}),
			bodyKeys(() => latest.current.offered),
			...(kit.blocks.some((block) => block.type === "footnote") ? [Footnotes] : []),
			ProposalMarks.configure({ take: (id) => latest.current.onTakeProposal?.(id) }),
			RequestMarks,
			UndoRedo,
			Dropcursor.configure({ width: 2 }),
			Gapcursor,
			RangeOverWholeBlocks,
		];
	}, [kit, blocks]);

	const editor = useEditor(
		{
			immediatelyRender: false,
			editable,
			extensions,
			content: docToEditor(doc, kit),
			editorProps: {
				attributes: { role: "textbox", "aria-multiline": "true", "aria-label": t("editor.label") },
				handleKeyDown: (view, event) => {
					// Korean is typed through composition: the menu's keys wait until a syllable is done.
					if (view.composing || event.isComposing || event.keyCode === 229) return false;
					return latest.current.keyDown?.(event) ?? false;
				},
				handlePaste: (_view, event) => {
					const files = [...(event.clipboardData?.files ?? [])];
					return files.length > 0 && made.current
						? (latest.current.onFiles?.(files, null, made.current) ?? false)
						: false;
				},
				handleDrop: (view, event) => {
					const files = [...(event.dataTransfer?.files ?? [])];
					if (files.length === 0 || !made.current) return false;
					const at = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos ?? null;
					return latest.current.onFiles?.(files, at, made.current) ?? false;
				},
			},
			// A body that begins with a picture is given a selection that picks it: nothing is picked before the person picks it (T193).
			onCreate: ({ editor: current }) => {
				const { state, view } = current;
				if (!(state.selection instanceof NodeSelection)) return;
				const none = nothingPicked(state.doc, ($pos) => new GapCursor($pos));
				view.dispatch(state.tr.setSelection(none).setMeta("addToHistory", false));
			},
			onUpdate: ({ editor: current }) => {
				latest.current.onChange(docFromEditor(current.getJSON(), kit));
				latest.current.onSelection?.(current);
			},
			onSelectionUpdate: ({ editor: current }) => latest.current.onSelection?.(current),
		},
		[extensions],
	);
	made.current = editor;
	return editor;
}

/** The body's length in characters, as the status bar counts it: the text of every block. */
export function docLength(doc: Doc): number {
	let count = 0;
	const walk = (blocks: Doc["blocks"]) => {
		for (const block of blocks) {
			for (const inline of block.content ?? []) if (inline.type === "text") count += [...inline.text].length;
			// A table's text is in its cells.
			if (block.type === "table")
				for (const row of (block.attrs?.rows as string[][] | undefined) ?? [])
					for (const cell of row) count += [...cell].length;
			if (block.children) walk(block.children);
		}
	};
	walk(doc.blocks);
	return count;
}
