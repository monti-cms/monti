"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useSite } from "@monti-cms/core/site";
import { cn } from "../../lib/utils/cn.js";
import { PanelResizeHandle } from "../../ui/panel-resize.js";
import { SIDE_PANEL_WIDTH } from "../shared/side-panel.js";
import { InspectorPanel } from "./inspector-panel.js";
import { SourcePane } from "./source-pane.js";
export function TranslationSourcePanel({ source, paneRef, onClose, }) {
    return (_jsx(SourcePane, { ref: paneRef, doc: source.doc, title: source.title, locale: source.locale, onClose: onClose, className: "absolute inset-y-0 left-0 z-10 w-[min(100%,28rem)] shadow-monti-pop lg:static lg:w-[45%] lg:shrink-0 lg:shadow-none" }));
}
export function InspectorSidePanel({ editor, resize, incomingItems, isLoadingIncoming, onRefreshIncoming, onClose, focusPath, onFocused, }) {
    const site = useSite();
    const { entry, collection } = editor;
    return (_jsxs("div", { className: cn("absolute inset-y-0 right-0 z-20 max-w-full shadow-monti-pop lg:relative lg:z-auto lg:shrink-0 lg:shadow-none", SIDE_PANEL_WIDTH), style: resize.style, children: [_jsx(PanelResizeHandle, { resize: resize }), site.isCollection(collection) && (_jsx(InspectorPanel, { incomingReferences: incomingItems, isLoadingIncomingReferences: isLoadingIncoming, onRefreshIncomingReferences: () => {
                    if (entry)
                        onRefreshIncoming(entry.id);
                }, onSlugChange: editor.setSlug, onRegenerateSlug: editor.regenerateSlug, onClose: onClose, focusPath: focusPath, onFocused: onFocused }))] }));
}
