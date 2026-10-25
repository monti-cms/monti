import type { Editor } from "@tiptap/core";
import { BLOCK_ID_ATTRIBUTE } from "../../editor/block-ids";
import type { OpenEditorEntry, OpenEditorSelection } from "../shared/open-editor";
import type { EntryData, EntryForm } from "./entry-form";

/** The longest text of the block at the cursor that is handed over; a longer block is cut. */
const MAX_BLOCK_CHARS = 4000;

/** The open entry as the form holds it: every field but the slug and the body (the body is the document), unsaved changes included. */
export function readOpenEntry(parts: {
	readonly form: EntryForm;
	readonly entry: Pick<EntryData, "id"> | null;
	readonly collection: string;
	readonly hasUnsavedChanges: boolean;
}): OpenEditorEntry {
	const { form, entry, collection, hasUnsavedChanges } = parts;
	const fields: Record<string, string | readonly string[] | null> = {};
	for (const [name, value] of Object.entries(form)) {
		if (name === "slug" || name === "doc") continue;
		fields[name] = value as string | readonly string[] | null;
	}
	return { collection, entryId: entry?.id ?? null, slug: form.slug, fields, body: form.doc, hasUnsavedChanges };
}

/** The selected text and the top-level block the selection starts in, from the visual editor. Without one (source mode) there is nothing selected. */
export function readOpenSelection(editor: Editor | null): OpenEditorSelection {
	if (!editor || editor.isDestroyed) return { text: "", block: null };
	const { doc, selection } = editor.state;
	const text = doc.textBetween(selection.from, selection.to, "\n");
	const $from = doc.resolve(selection.from);
	const node = $from.depth >= 1 ? $from.node(1) : $from.nodeAfter;
	const id = node?.attrs[BLOCK_ID_ATTRIBUTE];
	if (!node || typeof id !== "string") return { text, block: null };
	return { text, block: { id, type: node.type.name, text: node.textContent.slice(0, MAX_BLOCK_CHARS) } };
}
