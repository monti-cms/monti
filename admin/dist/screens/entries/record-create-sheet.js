"use client";
import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useRef, useState } from "react";
import { Sheet, SheetContent, SheetTitle } from "../../ui/sheet.js";
import { RecordPanel } from "../record-panel.js";
import { useConfirm } from "../shared/confirm-dialog.js";
import { t } from "./translate.js";
/** The saved item in the shape of a relation option. */
export const optionOf = (saved) => ({
    id: saved.id,
    title: String(saved.working?.metadata.title ?? "") || saved.workingSlug || t("untitled"),
    slug: saved.publishedSlug ?? saved.workingSlug ?? null,
});
/**
 * Right-hand sheet for adding a category (tag, category, collection) from the post edit screen. Opens the same sheet as the category sheet on the list screen
 * and fills in name, slug, description and translations at once. `create(...)` resolves to the created item on save, or null on close.
 * Render `sheet` once on the screen.
 */
export function useRecordCreator() {
    const [request, setRequest] = useState(null);
    const resolveRef = useRef(null);
    const dirtyRef = useRef(false);
    const { confirmDiscard, dialog } = useConfirm();
    const finish = useCallback((saved) => {
        resolveRef.current?.(saved);
        resolveRef.current = null;
        dirtyRef.current = false;
        setRequest(null);
    }, []);
    const create = useCallback((collection, initial) => new Promise((resolve) => {
        resolveRef.current?.(null);
        resolveRef.current = resolve;
        dirtyRef.current = false;
        setRequest({ collection, initial });
    }), []);
    const sheet = (_jsxs(_Fragment, { children: [_jsx(Sheet, { open: request !== null, onOpenChange: (open) => {
                    // Esc and outside clicks also ask about unsaved content, like the sheet's close button.
                    if (!open)
                        void confirmDiscard(dirtyRef.current).then((ok) => ok && finish(null));
                }, children: _jsxs(SheetContent, { showCloseButton: false, className: "gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:w-[22rem] data-[side=right]:sm:max-w-none", children: [_jsx(SheetTitle, { className: "sr-only", children: t("record.add") }), request && (_jsx(RecordPanel, { target: { collection: request.collection, id: null }, initial: request.initial, className: "border-l-0", onDirtyChange: (dirty) => {
                                dirtyRef.current = dirty;
                            }, onClose: () => finish(null), onSaved: (saved) => finish(saved) }))] }) }), dialog] }));
    return { create, sheet };
}
