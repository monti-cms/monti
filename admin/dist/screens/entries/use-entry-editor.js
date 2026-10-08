import { jsx as _jsx } from "react/jsx-runtime";
import { useSite } from "@monti-cms/core/client";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { BlockIssuesProvider } from "../../editor/blocks/block-issues-context.js";
import { useStoreSelector } from "../../hooks/store.js";
import { cmsIssueMessage } from "../api-error-message.js";
import { cmsEntryClient, localRecoveryStoreOf, } from "./entry-editor-client.js";
import { createEntryEditor, ENTRY_EDITOR_CORE, } from "./entry-editor-store.js";
import { formFromSourceMetadata } from "./entry-form.js";
import { EntryFormProvider } from "./use-field.js";
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
export function useEntryEditor(options) {
    const site = useSite();
    const callbacksRef = useRef({});
    const formatsRef = useRef(options.formats);
    formatsRef.current = options.formats;
    callbacksRef.current = { onSaved: options.onSaved };
    const [core] = useState(() => createEntryEditor({
        site,
        adminId: options.adminId,
        target: options.target,
        client: options.client ?? cmsEntryClient(site),
        recoveryStore: options.recoveryStore ?? localRecoveryStoreOf(site),
        callbacks: () => callbacksRef.current,
        formats: () => formatsRef.current,
    }));
    useEffect(() => {
        core.start();
        return () => core.stop();
    }, [core]);
    // When leaving the screen or hiding the tab, keep the pending recovery copy right away.
    useEffect(() => {
        const onHide = () => {
            if (document.visibilityState === "hidden")
                void core.flushRecovery();
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
        if (!warnOnLeave || saveStatus === "saved" || saveStatus === "new")
            return;
        const warn = (event) => {
            event.preventDefault();
            event.returnValue = "";
        };
        window.addEventListener("beforeunload", warn);
        return () => window.removeEventListener("beforeunload", warn);
    }, [saveStatus, warnOnLeave]);
    return useStoreSelector(core.store, core.view);
}
const EntryEditorContext = createContext(null);
/** The engine behind an editor value (see {@link ENTRY_EDITOR_CORE}). */
function coreOf(editor) {
    const core = editor[ENTRY_EDITOR_CORE];
    if (!core)
        throw new Error("EntryEditorProvider needs the value that useEntryEditor returned.");
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
export function EntryEditorProvider({ editor, lockedNote, children, }) {
    const site = useSite();
    const core = coreOf(editor);
    const { collection, entry } = editor;
    const locked = useMemo(() => entry?.source && site.isCollection(collection)
        ? { values: formFromSourceMetadata(site, collection, entry.source.metadata), note: lockedNote }
        : undefined, [entry?.source, collection, lockedNote, site]);
    // The warnings of the latest save or publish that point to a block are shown next to that block (`BlockFrame`).
    const blockIssues = useMemo(() => {
        const byBlock = new Map();
        for (const issue of editor.bodyWarnings) {
            const blockId = issue.position?.blockId;
            if (!blockId)
                continue;
            // Without the field path (`body`), which the block already says by where it is shown.
            byBlock.set(blockId, [...(byBlock.get(blockId) ?? []), cmsIssueMessage(site, { ...issue, path: undefined })]);
        }
        return byBlock;
    }, [editor.bodyWarnings, site]);
    return (_jsx(EntryEditorContext.Provider, { value: core, children: _jsx(BlockIssuesProvider, { issues: blockIssues, children: site.isCollection(collection) ? (_jsx(EntryFormProvider, { value: {
                    collection,
                    form: editor.form,
                    setForm: editor.setForm,
                    issues: editor.publishIssues,
                    disabled: editor.readOnly,
                    entryId: entry?.id,
                    locale: entry?.locale,
                    entry,
                    locked,
                }, children: children })) : (children) }) }));
}
const whole = (editor) => editor;
export function useEntryEditorContext(selector) {
    const core = useContext(EntryEditorContext);
    if (!core)
        throw new Error("useEntryEditorContext needs an EntryEditorProvider above it.");
    const select = (selector ?? whole);
    return useStoreSelector(core.store, (state) => select(core.view(state)));
}
