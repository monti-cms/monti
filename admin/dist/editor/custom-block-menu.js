"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { createTranslator } from "@monti-cms/core/client";
import { Puzzle } from "lucide-react";
import { useIconByName } from "../screens/shared/collection-icon.js";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu.js";
import { IconButton } from "../ui/icon-button.js";
import { editorMessages } from "./messages.js";
import { buildBlockSlashCommands } from "./slash-command.js";
const t = createTranslator(editorMessages);
const CUSTOM_BLOCKS = buildBlockSlashCommands();
/** Custom component list. Shared by the component menu and the toolbar "More" menu. Like the slash menu, it shows a description under each name. */
export function CustomBlockMenuItems({ editor }) {
    const iconByName = useIconByName();
    return CUSTOM_BLOCKS.map((block) => {
        // The block definition's icon (`editor.icon`). Falls back to a puzzle icon.
        const Icon = (typeof block.icon === "string" ? iconByName(block.icon) : block.icon) ?? Puzzle;
        return (_jsxs(DropdownMenuItem, { disabled: !editor.isEditable, 
            // This is a slash menu action with no text to delete, so pass an empty range at the cursor.
            onClick: () => {
                const { from } = editor.state.selection;
                block.action(editor, { from, to: from });
            }, children: [_jsx(Icon, { "aria-hidden": true, className: "size-4" }), _jsxs("span", { className: "min-w-0 flex-1", children: [_jsx("span", { className: "block truncate", children: block.title }), _jsx("span", { className: "block truncate text-cms-muted-foreground text-xs", children: block.description })] })] }, block.id ?? block.title));
    });
}
/** Inserts a custom component (block) at the cursor from the toolbar. */
export function CustomBlockMenu({ editor }) {
    return (_jsxs(DropdownMenu, { children: [_jsx(IconButton, { label: t("customBlockMenu.label"), side: "bottom", disabled: !editor.isEditable, onMouseDown: (event) => event.preventDefault(), trigger: (button) => _jsx(DropdownMenuTrigger, { render: button }), children: _jsx(Puzzle, { className: "size-4", "aria-hidden": true }) }), _jsx(DropdownMenuContent, { align: "start", className: "w-64", children: _jsx(CustomBlockMenuItems, { editor: editor }) })] }));
}
