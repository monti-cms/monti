"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useSite, useTranslator } from "@monti-cms/core/client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "../lib/utils/cn.js";
import { CollectionIcon } from "../screens/shared/collection-icon.js";
import { Spinner } from "../ui/spinner.js";
import { internalLinkHref } from "./internal-link.js";
import { editorMessages } from "./messages.js";
/** Line under the entry: collection name · address · draft status. */
function itemMeta(site, item) {
    const t = site.createTranslator(editorMessages);
    const collection = site.isCollection(item.collection)
        ? site.COLLECTION_DEFINITIONS[item.collection].label
        : item.collection;
    // Links to draft targets are allowed while editing but flagged. The target must be public to publish.
    const status = item.status && item.status !== "published"
        ? item.status === "draft"
            ? t("internalLink.draft")
            : item.status
        : null;
    // Show the public path (collection `path`) the link will actually point to.
    return [collection, internalLinkHref(site, item), status].filter(Boolean).join(" · ");
}
/**
 * `[[` internal entry link search results. Same look as the slash menu.
 * The editor handles focus and arrow keys; this only draws the highlighted item (`selectedIndex`) and scrolls it into view.
 */
export function InternalLinkPopup({ items, isLoading, error, coords, selectedIndex, onSelect, onClose, }) {
    const site = useSite();
    const t = useTranslator(editorMessages);
    const [mounted, setMounted] = useState(false);
    const listRef = useRef(null);
    useEffect(() => {
        setMounted(true);
    }, []);
    useEffect(() => {
        listRef.current
            ?.querySelector(`[data-index="${selectedIndex}"]`)
            ?.scrollIntoView({ block: "nearest" });
    }, [selectedIndex]);
    if (!mounted)
        return null;
    return createPortal(_jsxs("div", { ref: listRef, role: "listbox", "aria-label": t("internalLink.label"), "aria-busy": isLoading, tabIndex: -1, style: { position: "fixed", top: `${coords.top + 24}px`, left: `${coords.left}px`, zIndex: 9999 }, onKeyDown: (event) => {
            if (event.key === "Escape") {
                event.preventDefault();
                onClose();
            }
        }, className: "max-h-80 w-72 overflow-y-auto rounded-lg border bg-cms-popover p-1 text-cms-popover-foreground shadow-lg", children: [items.map((item, index) => (_jsxs("div", { role: "option", "aria-selected": index === selectedIndex, "data-index": index, tabIndex: -1, onMouseDown: (event) => event.preventDefault(), onClick: () => onSelect(item), onKeyDown: (event) => {
                    if (event.key === "Enter")
                        onSelect(item);
                }, className: cn("flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 outline-none", index === selectedIndex ? "bg-cms-accent text-cms-accent-foreground" : "hover:bg-cms-accent/50"), children: [_jsx("span", { "aria-hidden": true, className: "flex size-8 shrink-0 items-center justify-center rounded-md border bg-cms-background text-cms-muted-foreground [&_svg]:size-4", children: _jsx(CollectionIcon, { collection: item.collection }) }), _jsxs("span", { className: "min-w-0", children: [_jsx("span", { className: "block truncate font-medium text-sm", children: item.title }), _jsx("span", { className: "block truncate text-cms-muted-foreground text-xs", children: itemMeta(site, item) })] })] }, item.id))), isLoading ? (_jsxs("output", { className: "flex items-center gap-2 px-2 py-1.5 text-cms-muted-foreground text-xs", children: [_jsx(Spinner, { className: "size-3.5" }), t("internalLink.searching")] })) : error ? (_jsx("p", { role: "alert", className: "px-2 py-1.5 text-cms-destructive text-xs", children: error })) : (items.length === 0 && _jsx("p", { className: "px-2 py-1.5 text-cms-muted-foreground text-xs", children: t("internalLink.empty") }))] }), document.body);
}
