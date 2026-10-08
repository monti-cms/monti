"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { AttributeInput, BlockSettings, BlockSettingsField, ContainerToolbar, formatMeta, ToolbarButton, } from "@monti-cms/admin/blocks";
import { BlockFrame, Content, useBlockEditor } from "@monti-cms/admin/hooks";
import { cn, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@monti-cms/admin/kit";
import { useTranslator } from "@monti-cms/core/client";
import { File, FilePlus, Folder, FolderPlus, FolderTree, Trash2 } from "lucide-react";
import { useId } from "react";
import { filesOf, uniquePath } from "./editor-files.js";
import { codeExplorerMessages } from "./messages.js";
/** Placeholder paths of new entries. They are made unique against the paths already in the explorer. */
const NEW_FILE = { stem: "src/new-file", suffix: ".ts", language: "ts" };
const NEW_FOLDER = { stem: "src/new-folder", suffix: "/", language: "text" };
/**
 * Code explorer editing view (theme colors). The header lists the files (the code blocks' titles) and clicking one moves the cursor into
 * that file; the file holding the cursor is marked. Below it every file is an ordinary code block, edited in place (the path in its title field).
 * The toolbar adds files and folders, picks the file shown first, and deletes the block.
 */
export function CodeExplorerNodeView() {
    const t = useTranslator(codeExplorerMessages);
    const block = useBlockEditor();
    // `editable` follows lock changes (trash, source mode).
    const { editable, focusedChild: selectedIndex } = block;
    const openId = useId();
    const files = filesOf(block.children);
    const paths = files.filter((file) => !file.folder && file.path).map((file) => file.path);
    const open = typeof block.values.open === "string" ? block.values.open : "";
    const addEntry = ({ stem, suffix, language }) => {
        const title = uniquePath(files.map((file) => file.path), stem, suffix);
        // At the end of the container, after the last child.
        block.addChild({ name: "codeBlock", values: { language, meta: formatMeta({ title }) }, focus: true });
    };
    const removeBlock = () => {
        block.remove();
    };
    // A stale `open` (a renamed or deleted file) stays selectable so the setting is visible and can be changed.
    const openItems = [
        { value: "", label: t("open.first") },
        ...[...new Set(open && !paths.includes(open) ? [...paths, open] : paths)].map((path) => ({
            value: path,
            label: path,
        })),
    ];
    return (_jsxs(BlockFrame, { className: "my-6 rounded-md border bg-cms-background", children: [_jsxs("div", { contentEditable: false, className: "not-prose flex flex-col gap-2 rounded-t-md bg-cms-muted px-3 py-2", children: [_jsxs("div", { className: "flex items-center gap-2 font-medium text-cms-foreground text-sm", children: [_jsx(FolderTree, { "aria-hidden": true, className: "size-4 shrink-0 text-cms-muted-foreground" }), t("label")] }), files.length > 0 ? (_jsx("ul", { "aria-label": t("files"), className: "m-0 flex list-none flex-wrap gap-1 p-0", children: files.map((file) => {
                            const Icon = file.folder ? Folder : File;
                            const current = file.index === selectedIndex;
                            return (_jsx("li", { children: _jsxs("button", { type: "button", "aria-current": current ? "true" : undefined, onClick: () => block.focus({ child: file.index }), className: cn("inline-flex max-w-full items-center gap-1 rounded border border-transparent px-1.5 py-0.5 font-mono text-cms-muted-foreground text-xs hover:bg-cms-accent hover:text-cms-foreground", current && "border-cms-border bg-cms-background text-cms-foreground shadow-xs"), children: [_jsx(Icon, { "aria-hidden": true, className: "size-3 shrink-0" }), _jsx("span", { className: "truncate", children: file.path || t("untitled") })] }) }, file.index));
                        }) })) : null] }), _jsx(Content, { className: cn("px-3 pt-2 pb-3 text-cms-foreground", 
                // Set the first and last inner block prose margins to 0 so they do not add to the box padding (for nested custom blocks, the wrapper inside react-renderer holds the margin).
                "[&>*>:first-child]:mt-0 [&>*>:last-child]:mb-0", "[&>*>:first-child>[data-node-view-wrapper]]:mt-0 [&>*>:last-child>[data-node-view-wrapper]]:mb-0") }), editable ? (_jsxs(ContainerToolbar, { label: t("toolbar"), children: [_jsx(ToolbarButton, { label: t("add.file"), onClick: () => addEntry(NEW_FILE), children: _jsx(FilePlus, { "aria-hidden": true }) }), _jsx(ToolbarButton, { label: t("add.folder"), onClick: () => addEntry(NEW_FOLDER), children: _jsx(FolderPlus, { "aria-hidden": true }) }), _jsx(BlockSettings, { children: _jsxs(BlockSettingsField, { label: t("open.label"), htmlFor: openId, children: [paths.length > 0 ? (_jsxs(Select, { value: open, items: openItems, onValueChange: (next) => next !== null && block.setValue("open", String(next)), children: [_jsx(SelectTrigger, { id: openId, size: "sm", className: "h-7 w-full text-xs", children: _jsx(SelectValue, {}) }), _jsx(SelectContent, { children: openItems.map((item) => (_jsx(SelectItem, { value: item.value, children: item.label }, item.value))) })] })) : (_jsx(AttributeInput, { id: openId, value: open, placeholder: t("open.first"), onCommit: (next) => block.setValue("open", next), className: "h-7 w-full rounded-md border border-cms-input cms-dark:bg-cms-input/30 px-2 text-xs shadow-xs placeholder:text-cms-muted-foreground placeholder:opacity-100 focus-visible:border-cms-ring focus-visible:ring-3 focus-visible:ring-cms-ring/50" })), _jsx("p", { className: "text-cms-muted-foreground text-xs", children: t("open.hint") })] }) }), _jsx(ToolbarButton, { label: t("delete"), destructive: true, onClick: removeBlock, children: _jsx(Trash2, { "aria-hidden": true }) })] })) : null] }));
}
