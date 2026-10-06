import type { BrowserFormat } from "../../browser-format";

("use client");

import { isCollection } from "@monti-cms/core/client";
import { createContext, type ReactNode, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useStoreSelector } from "../../hooks/store";
import { cmsEntryClient, type EntryEditorClient, localRecoveryStore, type RecoveryStore } from "./entry-editor-client";
import {
	createEntryEditor,
	ENTRY_EDITOR_CORE,
	type EntryEditor,
	type EntryEditorCallbacks,
	type EntryEditorCore,
	type EntryEditorTarget,
} from "./entry-editor-store";
import { type EntryData, formFromSourceMetadata } from "./entry-form";
import { EntryFormProvider } from "./use-field";

/**
 * Options of {@link useEntryEditor}. `adminId` and `target` are read when the editor is created: to edit another entry, mount a new editor
 * (`key={entryId}` on the component that calls the hook). The callbacks, on the other hand, are read when they are needed, so a new function each render is fine.
 *
 * @experimental
 */
export interface UseEntryEditorOptions {
	/** Scope of the browser recovery copy (the key is `adminId:entryId`), so accounts never mix on a shared browser. */
	adminId: string;
	target: EntryEditorTarget;
	/**
	 * Called after every successful server write (save, publish, status change) with the entry as the server holds it. `created` is true for the first
	 * save of a new entry: the UI may then move the address bar to the entry's edit URL.
	 */
	onSaved?: (entry: EntryData, info: { created: boolean }) => void;
	/** Ask the browser to confirm before leaving the page with changes the server does not have. Default `true`. */
	warnOnLeave?: boolean;
	/** The server calls. Default: the admin API. */
	client?: EntryEditorClient;
	/** Where the recovery copy is kept. Default: the browser's IndexedDB. */
	recoveryStore?: RecoveryStore;
	/**
	 * The formats the browser can read (`useCmsAdminComponents().formats`). An old recovery copy written as text is read through the one named like its notation (`mdx`),
	 * so it compares with the server body like any other copy.
	 */
	formats?: Readonly<Record<string, BrowserFormat>>;
}

/**
 * Load, local recovery copy, explicit server save, publish, status changes, and recovery and conflict state of one entry. Build an editor UI on it
 * with `useField` for the fields.
 *
 * While editing, only a browser recovery copy is kept (IndexedDB, after input pauses; never sent to the server). The server draft changes only when
 * `save()`, `publish()` or a status change runs. This is not a server autosave: the state `saveStatus` says what the server has.
 *
 * - `load` says when the entry is ready. For an item collection it says `redirect`: the hook never navigates, the UI does.
 * - `recovery` and `conflict` are state. Answer them with `restoreRecovery()` / `discardRecovery()` and `overwriteWithMine()` / `reload()`; a
 *   conflict never reloads the page.
 * - Commands return `EditorResult` and never throw for expected failures (`conflict`, `session_expired`, `offline`, `validation`, ...). The hook shows no
 *   toast or dialog and does not navigate.
 *
 * The value changes with every state change. To re-render a component only for what it reads, put it under {@link EntryEditorProvider} and
 * use `useEntryEditorContext(selector)`.
 *
 * @experimental
 */
export function useEntryEditor(options: UseEntryEditorOptions): EntryEditor {
	const callbacksRef = useRef<EntryEditorCallbacks>({});
	const formatsRef = useRef(options.formats);
	formatsRef.current = options.formats;
	callbacksRef.current = { onSaved: options.onSaved };
	const [core] = useState(() =>
		createEntryEditor({
			adminId: options.adminId,
			target: options.target,
			client: options.client ?? cmsEntryClient,
			recoveryStore: options.recoveryStore ?? localRecoveryStore,
			callbacks: () => callbacksRef.current,
			formats: () => formatsRef.current,
		}),
	);

	useEffect(() => {
		core.start();
		return () => core.stop();
	}, [core]);

	// When leaving the screen or hiding the tab, keep the pending recovery copy right away.
	useEffect(() => {
		const onHide = () => {
			if (document.visibilityState === "hidden") void core.flushRecovery();
		};
		const onPageHide = () => void core.flushRecovery();
		document.addEventListener("visibilitychange", onHide);
		window.addEventListener("pagehide", onPageHide);
		return () => {
			document.removeEventListener("visibilitychange", onHide);
			window.removeEventListener("pagehide", onPageHide);
		};
	}, [core]);

	// Warn on page leave if there are changes the server does not have.
	const saveStatus = useStoreSelector(core.store, (state) => state.saveStatus);
	const warnOnLeave = options.warnOnLeave ?? true;
	useEffect(() => {
		if (!warnOnLeave || saveStatus === "saved" || saveStatus === "new") return;
		const warn = (event: BeforeUnloadEvent) => {
			event.preventDefault();
			event.returnValue = "";
		};
		window.addEventListener("beforeunload", warn);
		return () => window.removeEventListener("beforeunload", warn);
	}, [saveStatus, warnOnLeave]);

	return useStoreSelector(core.store, core.view);
}

const EntryEditorContext = createContext<EntryEditorCore | null>(null);

/** The engine behind an editor value (see {@link ENTRY_EDITOR_CORE}). */
function coreOf(editor: EntryEditor): EntryEditorCore {
	const core = (editor as { [ENTRY_EDITOR_CORE]?: EntryEditorCore })[ENTRY_EDITOR_CORE];
	if (!core) throw new Error("EntryEditorProvider needs the value that useEntryEditor returned.");
	return core;
}

/**
 * Shares one entry editor with the components below it, and provides the `EntryFormProvider` that `useField` reads, fed from the editor's form,
 * `setForm`, publish issues and entry. A component below reads the editor with {@link useEntryEditorContext}, and a field with `useField`.
 *
 * `lockedNote` is what a translation shows beside a field it shares with the original (where to change it); the original's values come from
 * the entry itself.
 *
 * @experimental
 */
export function EntryEditorProvider({
	editor,
	lockedNote,
	children,
}: {
	editor: EntryEditor;
	lockedNote?: ReactNode;
	children: ReactNode;
}) {
	const core = coreOf(editor);
	const { collection, entry } = editor;
	const locked = useMemo(
		() =>
			entry?.source && isCollection(collection)
				? { values: formFromSourceMetadata(collection, entry.source.metadata), note: lockedNote }
				: undefined,
		[entry?.source, collection, lockedNote],
	);
	return (
		<EntryEditorContext.Provider value={core}>
			{isCollection(collection) ? (
				<EntryFormProvider
					value={{
						collection,
						form: editor.form,
						setForm: editor.setForm,
						issues: editor.publishIssues,
						disabled: editor.readOnly,
						entryId: entry?.id,
						locale: entry?.locale,
						entry,
						locked,
					}}
				>
					{children}
				</EntryFormProvider>
			) : (
				children
			)}
		</EntryEditorContext.Provider>
	);
}

const whole = (editor: EntryEditor) => editor;

/**
 * The entry editor of the nearest {@link EntryEditorProvider}. With a `selector`, the component re-renders only when the selected value changes
 * (compared with `Object.is`), so the selector must return a stable value: a field of the editor, not a freshly built object.
 *
 * @experimental
 */
export function useEntryEditorContext(): EntryEditor;
export function useEntryEditorContext<T>(selector: (editor: EntryEditor) => T): T;
export function useEntryEditorContext<T>(selector?: (editor: EntryEditor) => T): EntryEditor | T {
	const core = useContext(EntryEditorContext);
	if (!core) throw new Error("useEntryEditorContext needs an EntryEditorProvider above it.");
	const select = (selector ?? whole) as (editor: EntryEditor) => T;
	return useStoreSelector(core.store, (state) => select(core.view(state)));
}
