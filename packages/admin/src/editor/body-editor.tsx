import type { Doc, MediaItem, MediaQueryResult } from "@monti-cms/core";
import { EditorBody } from "@monti-cms/ui";
import { type Editor, EditorContent } from "@tiptap/react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { MediaPickerDialog } from "../media/media-picker-dialog";
import { useAcceptFiles } from "../media/upload-problem";
import { useKeepFilesInPage } from "../media/use-file-drop";
import { useUpload } from "../media/use-upload";
import { useAdmin } from "../operations/admin-context";
import { useRead } from "../operations/use-operation";
import { BlockRequestContext, EntryLocaleContext } from "./block-api";
import { type BlockTranslation, useBlockHandle } from "./block-menu";
import type { BodyCatalogs } from "./catalog";
import { FormatCard } from "./format-card";
import { liveDom } from "./live-view";
import {
	EditorMedia,
	type EditorMediaValue,
	fileBlock,
	onImageCard,
	type PictureFill,
	placeFiles,
	placeLibraryFile,
	useBodyFiles,
} from "./media-context";
import { type BodyProposal, showProposals, takeInEditor } from "./proposal-marks";
import { type PickedText, pickedText } from "./request-marks";
import { nodeName } from "./schema";
import { useSlashMenu } from "./slash-menu";
import { useTableTools } from "./table-tools";
import {
	type AddedBlock,
	type PairedRows,
	pendingAsPlaceholders,
	restorePending,
	showPaired,
	showPlaceholders,
} from "./translation";
import { useBodyEditor } from "./use-body-editor";

/**
 * The body of an entry or a template (doc 03): the blocks in the reading column, the handle beside the block under the pointer, the "/" menu, the
 * format card and a table's grips and + strips. It shows the body it is mounted with; to show another, mount it again with a new `key`.
 */
export function BodyEditor({
	doc,
	catalogs,
	onChange,
	editable = true,
	templates = false,
	onEditor,
	proposals,
	translation,
	margin,
	paired = null,
	added,
	files,
	fill,
	onRequest,
	locale,
}: {
	/** The entry's language: a site block's empty title shows its kind in it, as the site will (doc 18). */
	locale?: string;
	doc: Doc;
	/** The library's files the body shows, as its read brought them: their shapes hold the pictures' places from the first draw. */
	files?: readonly MediaItem[];
	catalogs: BodyCatalogs;
	onChange: (doc: Doc) => void;
	editable?: boolean;
	/** The "/" menu offers the templates. Off where a template itself is written. */
	templates?: boolean;
	/** Hands the editor to the screen once it is made, so a to-do row can take the cursor to its block. */
	onEditor?: (editor: Editor | null) => void;
	/**
	 * The assistant's body proposals drawn over the text (T32), the one looked at (`current`), and what happens when one is taken here (the person
	 * changed a block it touches, so it went in first).
	 */
	proposals?: { items: BodyProposal[]; current: string | null; onTaken: (id: string) => void };
	/** A translation's block menu rows (doc 04). */
	translation?: BlockTranslation;
	/** What hangs in the text's left margin, drawn for the editor once it is made (a translation's marks). */
	margin?: (editor: Editor) => ReactNode;
	/** A translation side by side: the text as the rows beside its source (translation.md). */
	paired?: PairedRows | null;
	/** A translation's source blocks new since it was translated: each shows as one more undecided block where it goes (doc 04). */
	added?: AddedBlock[];
	/** "✦ Fill" for a picture's words and its caption (doc 10, quick tasks): an entry's body has it, on a site that can fill. */
	fill?: PictureFill;
	/** "✦ Request" on picked words (the format card's button, ⌘J): the screen opens the request's card (doc 10, item 28; T64). */
	onRequest?: (picked: PickedText) => void;
}) {
	const editorRef = useRef<Editor | null>(null);
	const latestProposals = useRef(proposals);
	latestProposals.current = proposals;
	const storage = useRead<MediaQueryResult>("media.query", { ids: [] }).data?.storage ?? false;
	useKeepFilesInPage();
	const [library, setLibrary] = useState<"image" | "file" | null>(null);
	const slash = useSlashMenu({ catalogs, templates, editorRef, onLibrary: storage ? setLibrary : undefined });
	const bodyFiles = useBodyFiles(files);
	// A file on its way up waits in its block; when the library has it, the block has it too, wherever it has moved since.
	const finished = useRef(new Map<string, MediaItem>());
	const accept = useAcceptFiles();
	const upload = useUpload({
		onUploaded: (item: MediaItem, done) => {
			finished.current.set(done.id, item);
			bodyFiles.know(item);
			const view = editorRef.current;
			if (!view || view.isDestroyed) return;
			view.state.doc.descendants((node, pos) => {
				if (node.attrs.upload !== done.id) return true;
				view.view.dispatch(
					view.state.tr
						// What was written while it went up stays: the caption is there from the start (flow 6·05).
						// A file whose type said nothing was taken for a file: the library knows what it is now.
						.setNodeMarkup(pos, view.schema.nodes[nodeName(item.kind)], {
							...node.attrs,
							upload: null,
							data: { ...node.attrs.data, ...fileBlock(item) },
						})
						.setMeta("addToHistory", false),
				);
				return false;
			});
		},
	});
	// A translation's undecided blocks go in empty, the source's words their placeholders, and come back in those words while nobody wrote in them;
	// a source block new since the translation goes in the same way, and stays out of the body while nobody wrote in it.
	// The editor is made once per mount, so the body it was mounted with is the one to read.
	// biome-ignore lint/correctness/useExhaustiveDependencies: once per mount, like the editor
	const placeholders = useMemo(() => pendingAsPlaceholders(doc, catalogs.kit, added), []);
	const editor = useBodyEditor({
		doc: placeholders.doc,
		catalogs,
		editable,
		onChange: (next) => onChange(restorePending(next, placeholders.originals)),
		keyDown: slash.keyDown,
		onSelection: slash.sync,
		onFiles: (files, at, view) => (storage ? placeFiles(view, files, at, accept, upload.add) : false),
		onTakeProposal: (id) => {
			const item = latestProposals.current?.items.find((each) => each.id === id);
			if (!item || !editorRef.current) return;
			takeInEditor(editorRef.current, item, catalogs.kit);
			latestProposals.current?.onTaken(id);
		},
	});
	editorRef.current = editor;
	const handle = useBlockHandle(editor, catalogs, translation);
	const tables = useTableTools(editor);
	const [card, setCard] = useState<string | null>(null);
	useEffect(() => (editor ? onImageCard(editor, setCard) : undefined), [editor]);
	const media = useMemo<EditorMediaValue>(
		() => ({
			uploads: upload.uploads,
			retry: upload.retry,
			holds: upload.holds,
			finished: (id) => finished.current.get(id),
			card,
			setCard,
			readOnly: !editable,
			files: bodyFiles.files,
			want: bodyFiles.want,
			know: bodyFiles.know,
			...(fill ? { fill } : {}),
		}),
		[upload.uploads, upload.retry, upload.holds, card, editable, bodyFiles.files, bodyFiles.want, bodyFiles.know, fill],
	);

	useEffect(() => onEditor?.(editor), [editor, onEditor]);
	/** A block's own ✦ (a formula's, doc 18): the request names the whole block. */
	const askAbout = (block: string) => {
		if (!editor || !onRequest) return;
		let found: { start: number; end: number } | null = null;
		editor.state.doc.descendants((node, at) => {
			if (found) return false;
			if (node.attrs.blockId === block) found = { start: at, end: at + node.nodeSize };
			return !found;
		});
		if (found)
			onRequest({ block, from: 0, to: 0, text: "", whole: true, ...(found as { start: number; end: number }) });
	};
	// ⌘J asks the assistant about the picked words, as the format card's "✦ request" does.
	const requested = useRef(onRequest);
	requested.current = editable ? onRequest : undefined;
	useEffect(() => {
		if (!editor || editor.isDestroyed) return;
		const dom = editor.view.dom;
		const onKey = (event: KeyboardEvent) => {
			if (!(event.metaKey || event.ctrlKey) || event.shiftKey || event.altKey || event.key.toLowerCase() !== "j")
				return;
			const picked = requested.current ? pickedText(editor.state) : null;
			if (!picked) return;
			event.preventDefault();
			requested.current?.(picked);
		};
		dom.addEventListener("keydown", onKey);
		return () => dom.removeEventListener("keydown", onKey);
	}, [editor]);
	useEffect(() => {
		if (editor && !editor.isDestroyed && placeholders.texts.size > 0)
			editor.view.dispatch(showPlaceholders(editor.state, placeholders.texts));
	}, [editor, placeholders]);

	useEffect(() => {
		if (editor && !editor.isDestroyed) editor.view.dispatch(showPaired(editor.state, paired));
	}, [editor, paired]);

	const items = proposals?.items;
	const current = proposals?.current ?? null;
	useEffect(() => {
		if (editor && !editor.isDestroyed) editor.view.dispatch(showProposals(editor.state, items ?? [], current));
	}, [editor, items, current]);

	useEffect(() => {
		if (editor && editor.isEditable !== editable) editor.setEditable(editable, false);
	}, [editor, editable]);

	return (
		<EditorMedia.Provider value={media}>
			<EditorBody
				paired={paired !== null}
				// The handle, the menus and the card are portals: their events pass through here in React's tree, but they are not presses on the text.
				onClick={(event) => {
					const target = event.target as Node;
					// A mark in the margin opens its card; it is not a press under the text.
					if (target instanceof Element && target.closest("[data-slot=editor-margin]")) return;
					// A press under the last block puts the cursor at the end of the text. Under a block with no text of its own (a picture, a file), a new
					// paragraph opens there, as Notion does: no need to know that Enter on the picked block makes one (2026-11-10, owner).
					const dom = liveDom(editor);
					if (!editor || !dom || !event.currentTarget.contains(target) || dom.contains(target)) return;
					const last = editor.state.doc.lastChild;
					if (editor.isEditable && last && !last.isTextblock)
						editor.chain().insertContentAt(editor.state.doc.content.size, { type: "paragraph" }).focus("end").run();
					else editor.chain().focus("end").run();
				}}
			>
				<EntryLocaleContext.Provider value={locale}>
					<BlockRequestContext.Provider value={editable && onRequest && editor ? askAbout : undefined}>
						<EditorContent editor={editor} />
					</BlockRequestContext.Provider>
				</EntryLocaleContext.Provider>
				<MarkLooks />
				{editor && margin ? margin(editor) : null}
				{handle.overlay}
				{tables.overlay}
				{slash.menu}
				{editor ? (
					<FormatCard editor={editor} catalogs={catalogs} onRequest={editable ? onRequest : undefined} />
				) : null}
				{library && (
					<MediaPickerDialog
						kind={library}
						onClose={() => {
							setLibrary(null);
							editor?.commands.focus();
						}}
						onPick={(item) => {
							setLibrary(null);
							bodyFiles.know(item);
							if (editor) placeLibraryFile(editor, item);
						}}
						onFiles={(files, folder) => {
							setLibrary(null);
							if (editor) placeFiles(editor, files, null, accept, (taken) => upload.add(taken, folder));
						}}
					/>
				)}
			</EditorBody>
		</EditorMedia.Provider>
	);
}

/**
 * The site's marks' looks (doc 18): each mark's site component loads its own stylesheet (`<style href precedence>`, once), so the editor draws a colour
 * or a tooltip's words as the site does. They are drawn here once, out of sight, for that.
 */
function MarkLooks() {
	const { marks } = useAdmin();
	return (
		<div hidden>{[...marks.values()].map(({ type, Site }) => (Site ? <Site key={type} mark={{ type }} /> : null))}</div>
	);
}
