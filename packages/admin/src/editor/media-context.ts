import type { MediaItem } from "@monti-cms/core";
import type { Node as EditorNode } from "@tiptap/pm/model";
import { NodeSelection, type Transaction } from "@tiptap/pm/state";
import type { Editor } from "@tiptap/react";
import { createContext } from "react";
import type { Upload } from "../media/upload-queue";
import { caretPast, insertBlocks, inTableCell } from "./commands";
import { nodeName } from "./schema";

/** What a body's image and file blocks need from the editor around them: the files on their way up, and which image's settings card is open. */
export type EditorMediaValue = {
	uploads: readonly Upload[];
	remove: (upload: Upload) => void;
	retry: (upload: Upload) => void;
	shrink: (upload: Upload) => unknown;
	/** Whether this file is still this page's, going up or stopped with its reason. */
	holds: (id: string) => boolean;
	/** What a finished upload became, for a block that comes back after it ended (undo, then redo). */
	finished: (id: string) => MediaItem | undefined;
	/** The block whose settings card is open. */
	card: string | null;
	setCard: (blockId: string | null) => void;
};

export const EditorMedia = createContext<EditorMediaValue | null>(null);

/** The block's attrs for a file the library has. Alt text and caption start empty: they are this entry's to write (doc 09). */
export const fileBlock = (item: Pick<MediaItem, "id" | "kind" | "name">) =>
	item.kind === "image" ? { media: item.id } : { media: item.id, name: item.name };

const put = (tr: Transaction, nodes: EditorNode[]) => caretPast(insertBlocks(tr, nodes));

/** Files pasted or dropped: each is a block at once, where the caret or the drop is, and goes up in its place with no window (doc 09, principle 4). A table's cell holds text only, so it is not a place for one. */
export function placeFiles(
	editor: Editor,
	files: readonly File[],
	at: number | null,
	add: (files: readonly File[]) => Upload[],
): boolean {
	const { state, view } = editor;
	const tr = state.tr;
	if (at !== null) tr.setSelection(NodeSelection.near(tr.doc.resolve(at)));
	if (inTableCell(tr.selection.$from)) return false;
	const nodes = add(files).flatMap((upload, index) => {
		const type = files[index]?.type.startsWith("image/") ? "image" : "file";
		return state.schema.nodes[nodeName(type)]?.create({ upload: upload.id, data: { media: "" } }) ?? [];
	});
	put(tr, nodes);
	view.dispatch(tr.scrollIntoView());
	editor.commands.focus();
	return true;
}

/** A file chosen in the library's window goes where the caret is. */
export function placeLibraryFile(editor: Editor, item: Pick<MediaItem, "id" | "kind" | "name">) {
	const { state, view } = editor;
	const type = state.schema.nodes[nodeName(item.kind)];
	if (!type) return;
	const tr = state.tr;
	put(tr, [type.create({ data: fileBlock(item) })]);
	view.dispatch(tr.scrollIntoView());
	editor.commands.focus();
}

type CardListener = (blockId: string | null) => void;
const cardListeners = new WeakMap<Editor, CardListener>();

/** Tells the body which image's settings card to open (a to-do row, "next image"). */
export function onImageCard(editor: Editor, listener: CardListener) {
	cardListeners.set(editor, listener);
	return () => {
		cardListeners.delete(editor);
	};
}

/** Takes the cursor to an image and opens its settings card there, where its alt text is written (flow 1·12). */
export function openImageCard(editor: Editor, blockId: string) {
	let at: number | null = null;
	editor.state.doc.descendants((node, pos) => {
		if (at !== null) return false;
		if (node.attrs.blockId === blockId) at = pos;
		return true;
	});
	if (at === null) return false;
	// No focus for the text: the card's alt text takes it, and the editor's would come a frame later and take it back.
	editor.chain().setNodeSelection(at).scrollIntoView().run();
	cardListeners.get(editor)?.(blockId);
	return true;
}

/** The next image in the body with nothing to say for it, after this one and round to the start; `null` when this was the last. */
export function nextBlankImage(editor: Editor, after: string): string | null {
	const blanks: string[] = [];
	editor.state.doc.descendants((node) => {
		if (node.type.name !== nodeName("image")) return true;
		const data = (node.attrs.data ?? {}) as { alt?: unknown; decorative?: unknown; media?: unknown };
		const said = typeof data.alt === "string" && data.alt.trim() !== "";
		if (!said && data.decorative !== true && data.media) blanks.push(String(node.attrs.blockId));
		return false;
	});
	const others = blanks.filter((id) => id !== after);
	const here = blanks.indexOf(after);
	return blanks.slice(here + 1).find((id) => id !== after) ?? others[0] ?? null;
}
