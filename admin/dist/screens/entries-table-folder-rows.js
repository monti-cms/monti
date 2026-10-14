import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Folder rows shown above the entries in folder browse mode: the move-to-parent row and subfolder rows.
import { useSite, useTranslator } from "@monti-cms/core/client";
import { Folder as FolderIcon, FolderOpen, FolderUp } from "lucide-react";
import { commonMessages } from "../lib/common.messages.js";
import { Button } from "../ui/button.js";
import { TableCell, TableRow } from "../ui/table.js";
import { folderKeyHandler } from "./admin-sidebar.js";
import { screensMessages } from "./messages.js";
import { ActionContextMenu, MoreActionsButton } from "./shared/action-menu.js";
import { folderMenuActions } from "./shared/use-folder-actions.js";
export function EntriesTableFolderRows({ explorer, folders, folderActions, visibleCount, onSelectFolder, }) {
    const site = useSite();
    const t = useTranslator(screensMessages);
    const tc = useTranslator(commonMessages);
    // Add "Open" to the same folder menu as the sidebar tree.
    const folderRowMenu = (folder) => folderActions
        ? [
            { kind: "item", label: tc("open"), icon: FolderOpen, onSelect: () => onSelectFolder(folder.id) },
            { kind: "separator" },
            ...folderMenuActions(site, folder, folders, folderActions),
        ]
        : [];
    return (_jsxs(_Fragment, { children: [explorer.parent !== null && (_jsxs(TableRow, { children: [_jsx(TableCell, { className: "text-center text-cms-muted-foreground", children: _jsx(FolderUp, { "aria-hidden": true, className: "mx-auto size-4" }) }), _jsx(TableCell, { colSpan: visibleCount - 1, children: _jsx(Button, { type: "button", variant: "link", size: "sm", onClick: () => onSelectFolder(explorer.parent ?? "all"), className: "h-auto p-0 text-cms-muted-foreground hover:text-cms-foreground", children: t("list.folderUp") }) })] })), explorer.folders.map((folder) => (_jsxs(ActionContextMenu, { actions: folderRowMenu(folder), trigger: _jsx(TableRow, {}), children: [_jsx(TableCell, { className: "text-center text-cms-muted-foreground", children: _jsx(FolderIcon, { "aria-hidden": true, className: "mx-auto size-4" }) }), _jsx(TableCell, { colSpan: visibleCount - 2, className: "font-medium", children: _jsx(Button, { type: "button", variant: "link", size: "sm", onClick: () => onSelectFolder(folder.id), onKeyDown: folderActions ? folderKeyHandler(folder, folderActions) : undefined, className: "h-auto p-0 font-medium text-cms-foreground", children: folder.name }) }), _jsx(TableCell, { className: "text-right", children: _jsx(MoreActionsButton, { actions: folderRowMenu(folder), label: t("list.folderActions", { name: folder.name }) }) })] }, `folder-${folder.id}`)))] }));
}
