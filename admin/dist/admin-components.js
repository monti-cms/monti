"use client";
import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, Fragment, useCallback, useContext, useMemo, useRef, } from "react";
import { useTextCheckEditor } from "./editor/text-check/extension.js";
/** Whether the registered value is input parts (a plain object, not a component). */
export const isFieldInputParts = (entry) => typeof entry === "object" && entry !== null && !("$$typeof" in entry);
const CmsAdminComponentsContext = createContext({});
export function CmsAdminComponentsProvider({ components, children, }) {
    const parent = useContext(CmsAdminComponentsContext);
    const value = useMemo(() => ({
        fencePreviews: { ...parent.fencePreviews, ...components.fencePreviews },
        fieldInputs: { ...parent.fieldInputs, ...components.fieldInputs },
        blockEditors: { ...parent.blockEditors, ...components.blockEditors },
        blockViews: { ...parent.blockViews, ...components.blockViews },
        editorExtensions: [...(parent.editorExtensions ?? []), ...(components.editorExtensions ?? [])],
        textCheckers: [...(parent.textCheckers ?? []), ...(components.textCheckers ?? [])],
        marks: { ...parent.marks, ...components.marks },
        icons: { ...parent.icons, ...components.icons },
        fieldViews: { ...parent.fieldViews, ...components.fieldViews },
        listCells: { ...parent.listCells, ...components.listCells },
    }), [parent, components]);
    return _jsx(CmsAdminComponentsContext.Provider, { value: value, children: children });
}
export const useCmsAdminComponents = () => useContext(CmsAdminComponentsContext);
const NO_CHECKERS = [];
/** Calls all registered edit screen extensions and text check screens and merges them into one. */
export function useEditorExtensions(context) {
    const { editorExtensions = [], textCheckers = NO_CHECKERS } = useCmsAdminComponents();
    // The extension list stays the same while the admin UI is shown. Every render calls the same number of hooks in the same order.
    const results = [
        ...editorExtensions.map((extension) => extension(context)),
        useTextCheckEditor(textCheckers, context),
    ];
    const editorCallbacks = results.flatMap((result) => (result.onEditor ? [result.onEditor] : []));
    const callbacksRef = useRef(editorCallbacks);
    callbacksRef.current = editorCallbacks;
    const onEditor = useCallback((editor) => {
        for (const callback of callbacksRef.current)
            callback(editor);
    }, []);
    return {
        // biome-ignore lint/suspicious/noArrayIndexKey: the extension list and its order do not change
        toolbar: results.map((result, index) => _jsx(Fragment, { children: result.toolbar }, index)),
        // biome-ignore lint/suspicious/noArrayIndexKey: the extension list and its order do not change
        overlay: results.map((result, index) => _jsx(Fragment, { children: result.overlay }, index)),
        blockActions: results.flatMap((result) => result.blockActions ?? []),
        selectionActions: results.flatMap((result) => result.selectionActions ?? []),
        insertActions: results.flatMap((result) => result.insertActions ?? []),
        onEditor,
    };
}
