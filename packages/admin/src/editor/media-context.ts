import type { MediaItem, MediaQueryResult } from "@monti-cms/core";
import { altIsMissing, MEDIA_QUERY_MOST } from "@monti-cms/core";
import type { Node as EditorNode } from "@tiptap/pm/model";
import { NodeSelection, type Transaction } from "@tiptap/pm/state";
import type { Editor } from "@tiptap/react";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { Upload } from "../media/upload-queue";
import { useOperation } from "../operations/use-operation";
import { caretPast, insertBlocks, inTableCell } from "./commands";
import { nodeName } from "./schema";

/** What a body's image and file blocks need from the editor around them: the files on their way up, and which image's settings card is open. */
export type EditorMediaValue = {
	uploads: readonly Upload[];
	retry: (upload: Upload) => void;
	/** Whether this file is still this page's, going up or cut off. */
	holds: (id: string) => boolean;
	/** What a finished upload became, for a block that comes back after it ended (undo, then redo). */
	finished: (id: string) => MediaItem | undefined;
	/** The block whose settings card is open. */
	card: string | null;
	setCard: (blockId: string | null) => void;
	/** The body cannot be changed (an archived entry, one in the trash). Here, so that a block already drawn hears of it when the entry is archived. */
	readOnly: boolean;
} & BodyFiles;

export const EditorMedia = createContext<EditorMediaValue | null>(null);

type BodyFiles = {
	/** The library's files the body's blocks show, by id: null for one the library does not have. One not here yet is being read. */
	files: ReadonlyMap<string, MediaItem | null>;
	/** Asks for a file, read again if known; those asked in the same moment are read together. */
	want: (id: string) => void;
	/**
	 * Tells the body of a file it has in hand already (one just picked in the library's window, one whose upload just ended): its block shows it from its first
	 * draw, at its own shape, with nothing read. Read first, the block stood as the empty 16:9 frame until the answer came (T136).
	 */
	know: (item: MediaItem) => void;
};

const NONE: readonly MediaItem[] = [];
/** The reads' answers that a body was already drawn from: a body made again from the same one (a kept copy loaded) no longer takes it as fresh. */
const drawnFrom = new WeakSet<readonly MediaItem[]>();
const byId = (items: readonly MediaItem[]) => items.map((item) => [item.id, item] as const);

/**
 * The files a body's image and file blocks show. Those the body's read brought (`given`: `entries.get`, `templates.get`) are known from the first
 * draw, so every picture's frame stands at its shape before anything is read; when the read comes again (after a save), what it brings is the
 * newest. A file that was not given (one put in since) is read: the blocks that appear at once ask in the same moment, and one `media.query` reads
 * them all, not a read for each block (T110). A block that comes back (undo, the same file picked again) reads its file again, and shows what it
 * knew meanwhile.
 */
export function useBodyFiles(given: readonly MediaItem[] = NONE): BodyFiles {
	const { run } = useOperation<MediaQueryResult>("media.query");
	const [files, setFiles] = useState<ReadonlyMap<string, MediaItem | null>>(() => new Map(byId(given)));
	const [taken, setTaken] = useState(given);
	if (taken !== given) {
		setTaken(given);
		setFiles((known) => new Map([...known, ...byId(given)]));
	}
	// A file that came with a read just made is not read again when its block first appears: only when the block comes back.
	const fresh = useRef<Set<string> | null>(null);
	if (fresh.current === null) {
		fresh.current = new Set(drawnFrom.has(given) ? [] : given.map((item) => item.id));
		drawnFrom.add(given);
	}
	const waiting = useRef(new Set<string>());
	// Each id's latest read: an answer that comes back after a newer read of the same file has begun says nothing about it.
	const latest = useRef(new Map<string, number>());
	const reads = useRef(0);
	const read = useCallback(
		async (ids: string[]) => {
			const call = ++reads.current;
			for (const id of ids) latest.current.set(id, call);
			const result = await run({ ids, pageSize: ids.length }).catch(() => null);
			const found = result?.ok ? new Map(result.body.items.map((item) => [item.id, item])) : null;
			const answered = ids.filter((id) => latest.current.get(id) === call);
			setFiles(
				(known) =>
					new Map([
						...known,
						// Not read (refused, the network): a file already shown stays; one never shown says it is not there, as a block's own read did. The
						// block reads again when it comes back.
						...answered.flatMap((id) =>
							found ? [[id, found.get(id) ?? null] as const] : known.has(id) ? [] : [[id, null] as const],
						),
					]),
			);
		},
		[run],
	);
	const want = useCallback(
		(id: string) => {
			if (fresh.current?.delete(id)) return;
			if (waiting.current.has(id)) return;
			waiting.current.add(id);
			if (waiting.current.size > 1) return;
			// The blocks of an opened body mount one after another in the same task: the read waits for the last of them.
			setTimeout(() => {
				const ids = [...waiting.current];
				waiting.current.clear();
				for (let start = 0; start < ids.length; start += MEDIA_QUERY_MOST)
					void read(ids.slice(start, start + MEDIA_QUERY_MOST));
			});
		},
		[read],
	);
	const know = useCallback((item: MediaItem) => {
		fresh.current?.add(item.id);
		setFiles((known) => new Map([...known, [item.id, item]]));
	}, []);
	return { files, want, know };
}

/** The library's file a body block shows: `item` once read, `missing` when the library does not have it. */
export function useBodyFile(id: string | undefined): { item: MediaItem | null; missing: boolean } {
	const media = useContext(EditorMedia);
	const want = media?.want;
	useEffect(() => {
		if (id) want?.(id);
	}, [id, want]);
	const known = id ? media?.files.get(id) : undefined;
	return { item: known ?? null, missing: known === null };
}

/** The block's attrs for a file the library has. Alt text and caption start empty: they are this entry's to write (doc 09). */
export const fileBlock = (item: Pick<MediaItem, "id" | "kind" | "name">) =>
	item.kind === "image" ? { media: item.id } : { media: item.id, name: item.name };

const put = (tr: Transaction, nodes: EditorNode[]) => caretPast(insertBlocks(tr, nodes));

/**
 * Files pasted or dropped: each one the library takes is a block at once, where the caret or the drop is, and goes up in its place with no window (doc 09, principle 4). One it
 * refuses never becomes a block. A table's cell holds text only, so it is not a place for one.
 */
export function placeFiles(
	editor: Editor,
	files: readonly File[],
	at: number | null,
	accept: (files: readonly File[]) => Promise<File[]>,
	add: (files: readonly File[]) => Upload[],
): boolean {
	const where = editor.state.tr;
	if (at !== null) where.setSelection(NodeSelection.near(where.doc.resolve(at)));
	if (inTableCell(where.selection.$from)) return false;
	void accept(files).then((taken) => {
		if (taken.length === 0 || editor.isDestroyed) return;
		const { state, view } = editor;
		const tr = state.tr;
		// The text may have changed while the files were looked at.
		if (at !== null) tr.setSelection(NodeSelection.near(tr.doc.resolve(Math.min(at, tr.doc.content.size))));
		if (inTableCell(tr.selection.$from)) return;
		const nodes = add(taken).flatMap((upload, index) => {
			const type = taken[index]?.type.startsWith("image/") ? "image" : "file";
			return state.schema.nodes[nodeName(type)]?.create({ upload: upload.id, data: { media: "" } }) ?? [];
		});
		put(tr, nodes);
		view.dispatch(tr.scrollIntoView());
		editor.commands.focus();
	});
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
		if (altIsMissing(data) && data.media) blanks.push(String(node.attrs.blockId));
		return false;
	});
	const others = blanks.filter((id) => id !== after);
	const here = blanks.indexOf(after);
	return blanks.slice(here + 1).find((id) => id !== after) ?? others[0] ?? null;
}
