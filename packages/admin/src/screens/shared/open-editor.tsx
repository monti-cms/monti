"use client";

import type { StoredDocument } from "@monti-cms/core/document";
import { createContext, type ReactNode, useContext } from "react";

/** The open entry as the form holds it now: unsaved changes included. */
export interface OpenEditorEntry {
	readonly collection: string;
	/** `null` for an entry that is not saved yet. */
	readonly entryId: string | null;
	readonly slug: string;
	/** The fields other than the slug and the body, by name, as the form holds them (text, a single relation or a date as a string, a multi relation as a list). */
	readonly fields: Readonly<Record<string, string | readonly string[] | null>>;
	readonly body: StoredDocument;
	/** Whether the form differs from what the server last saved. */
	readonly hasUnsavedChanges: boolean;
}

/** What is selected in the visual editor, and the block the cursor is in. */
export interface OpenEditorSelection {
	/** The selected text; empty when the selection is only a cursor. */
	readonly text: string;
	/** The top-level block of the cursor (or the start of the selection), with its block id. `null` when the body is not open as blocks (source mode). */
	readonly block: { readonly id: string; readonly type: string; readonly text: string } | null;
}

/** The entry editor on screen, for a side panel that reads it: the entry as the form holds it, and the selection. Read on call, so an answer is never stale. */
export interface OpenEditor {
	readEntry(): OpenEditorEntry;
	readSelection(): OpenEditorSelection;
}

export const OpenEditorContext = createContext<OpenEditor | null>(null);

/** Shows an editor to the side panel below it. The entry editor screen does this itself; a story or a test of a panel gives a stand-in. */
export function OpenEditorProvider({ editor, children }: { editor: OpenEditor; children: ReactNode }) {
	return <OpenEditorContext.Provider value={editor}>{children}</OpenEditorContext.Provider>;
}

/** The entry editor the caller is shown with, or `null` on every other screen (and for the panel, while no entry is open). */
export const useOpenEditor = (): OpenEditor | null => useContext(OpenEditorContext);
