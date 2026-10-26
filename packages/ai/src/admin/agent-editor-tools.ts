import type { BrowserFormat, OpenEditor } from "@monti-cms/admin";

/** The tools the browser answers: the server declares them (without `execute`) only when an entry is open in the editor. */
export const EDITOR_TOOLS = ["editor_read", "editor_selection"] as const;
export type EditorToolName = (typeof EDITOR_TOOLS)[number];

export const isEditorTool = (name: string): name is EditorToolName =>
	(EDITOR_TOOLS as readonly string[]).includes(name);

/** What `editor_read` answers: the open entry as the form holds it, unsaved changes included, with the body as text in the site's format. */
export interface EditorReadAnswer {
	readonly collection: string;
	readonly entryId: string | null;
	readonly slug: string;
	readonly fields: Readonly<Record<string, string | readonly string[] | null>>;
	/** The body in the format named by `bodyFormat`; `null` when the site has no format to write it in. */
	readonly body: string | null;
	readonly bodyFormat: string | null;
	readonly unsavedChanges: boolean;
}

/** What `editor_selection` answers: the selected text (empty for a cursor) and the block the cursor is in, with its block id. */
export interface EditorSelectionAnswer {
	readonly text: string;
	readonly block: { readonly id: string; readonly type: string; readonly text: string } | null;
}

/** The body as text. A body the format could not read comes back as the text it was. */
const bodyText = (format: BrowserFormat | undefined, doc: Parameters<BrowserFormat["export"]>[0]): string | null =>
	format ? format.export(doc).trim() : null;

/** Answers one editor tool from the open editor, at the time of the call. */
export function answerEditorTool(
	tool: "editor_read",
	editor: OpenEditor,
	format: BrowserFormat | undefined,
): EditorReadAnswer;
export function answerEditorTool(
	tool: "editor_selection",
	editor: OpenEditor,
	format: BrowserFormat | undefined,
): EditorSelectionAnswer;
export function answerEditorTool(
	tool: EditorToolName,
	editor: OpenEditor,
	format: BrowserFormat | undefined,
): EditorReadAnswer | EditorSelectionAnswer;
export function answerEditorTool(
	tool: EditorToolName,
	editor: OpenEditor,
	format: BrowserFormat | undefined,
): EditorReadAnswer | EditorSelectionAnswer {
	if (tool === "editor_selection") return editor.readSelection();
	const entry = editor.readEntry();
	return {
		collection: entry.collection,
		entryId: entry.entryId,
		slug: entry.slug,
		fields: entry.fields,
		body: bodyText(format, entry.body),
		bodyFormat: format ? format.name : null,
		unsavedChanges: entry.hasUnsavedChanges,
	};
}
