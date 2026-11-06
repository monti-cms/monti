import type { Doc } from "@monti-cms/core";
import { EditorBody } from "@monti-cms/ui";
import { type Editor, EditorContent } from "@tiptap/react";
import { useEffect, useRef } from "react";
import { useBlockHandle } from "./block-menu";
import type { BodyCatalogs } from "./catalog";
import { FormatCard } from "./format-card";
import { type BodyProposal, showProposals, takeInEditor } from "./proposal-marks";
import { useSlashMenu } from "./slash-menu";
import { useTableTools } from "./table-tools";
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
}: {
	doc: Doc;
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
}) {
	const editorRef = useRef<Editor | null>(null);
	const latestProposals = useRef(proposals);
	latestProposals.current = proposals;
	const slash = useSlashMenu({ catalogs, templates, editorRef });
	const editor = useBodyEditor({
		doc,
		catalogs,
		editable,
		onChange,
		keyDown: slash.keyDown,
		onSelection: slash.sync,
		onTakeProposal: (id) => {
			const item = latestProposals.current?.items.find((each) => each.id === id);
			if (!item || !editorRef.current) return;
			takeInEditor(editorRef.current, item, catalogs.kit);
			latestProposals.current?.onTaken(id);
		},
	});
	editorRef.current = editor;
	const handle = useBlockHandle(editor, catalogs);
	const tables = useTableTools(editor);

	useEffect(() => onEditor?.(editor), [editor, onEditor]);

	const items = proposals?.items;
	const current = proposals?.current ?? null;
	useEffect(() => {
		if (editor && !editor.isDestroyed) editor.view.dispatch(showProposals(editor.state, items ?? [], current));
	}, [editor, items, current]);

	useEffect(() => {
		if (editor && editor.isEditable !== editable) editor.setEditable(editable, false);
	}, [editor, editable]);

	return (
		<EditorBody
			// The handle, the menus and the card are portals: their events pass through here in React's tree, but they are not presses on the text.
			onClick={(event) => {
				const target = event.target as Node;
				// A press under the last block puts the cursor at the end of the text.
				if (editor && event.currentTarget.contains(target) && !editor.view.dom.contains(target))
					editor.chain().focus("end").run();
			}}
		>
			<EditorContent editor={editor} />
			{handle.overlay}
			{tables.overlay}
			{slash.menu}
			{editor ? <FormatCard editor={editor} catalogs={catalogs} /> : null}
		</EditorBody>
	);
}
