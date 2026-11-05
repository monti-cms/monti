import type { Doc } from "@monti-cms/core";
import { Dropcursor, Gapcursor, UndoRedo } from "@tiptap/extensions";
import type { Node as EditorNode } from "@tiptap/pm/model";
import { type Editor, useEditor } from "@tiptap/react";
import { useMemo, useRef } from "react";
import { useAdmin } from "../operations/admin-context";
import { useRead } from "../operations/use-operation";
import type { BodyCatalogs, Catalog, CatalogBlock } from "./catalog";
import { docFromEditor, docToEditor } from "./convert";
import { bodyKeys } from "./keys";
import { BlockIds, bodyStates } from "./plugins";
import { bodyExtensions, nodeName } from "./schema";

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
}: {
	doc: Doc;
	catalogs: BodyCatalogs;
	editable?: boolean;
	onChange: (doc: Doc) => void;
	keyDown?: (event: KeyboardEvent) => boolean;
	onSelection?: (editor: Editor) => void;
}) {
	const { t } = useAdmin();
	const { kit, offered } = catalogs;
	const latest = useRef({ t, offered, onChange, keyDown, onSelection });
	latest.current = { t, offered, onChange, keyDown, onSelection };

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
			...bodyExtensions(kit, boxLabel),
			BlockIds,
			bodyStates({
				labels: () => ({ placeholder: latest.current.t("editor.placeholder"), off: latest.current.t("editor.off") }),
				offered: () => isOffered,
			}),
			bodyKeys(() => latest.current.offered),
			UndoRedo,
			Dropcursor.configure({ width: 2 }),
			Gapcursor,
		];
	}, [kit]);

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
			},
			onUpdate: ({ editor: current }) => {
				latest.current.onChange(docFromEditor(current.getJSON(), kit));
				latest.current.onSelection?.(current);
			},
			onSelectionUpdate: ({ editor: current }) => latest.current.onSelection?.(current),
		},
		[extensions],
	);
	return editor;
}

/** The body's length in characters, as the status bar counts it: the text of every block. */
export function docLength(doc: Doc): number {
	let count = 0;
	const walk = (blocks: Doc["blocks"]) => {
		for (const block of blocks) {
			for (const inline of block.content ?? []) if (inline.type === "text") count += [...inline.text].length;
			if (block.children) walk(block.children);
		}
	};
	walk(doc.blocks);
	return count;
}
