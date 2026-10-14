import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { AlignLeft, ImageIcon, Link2, List, Paperclip, Superscript, Upload } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu.js";
import { IconButton } from "../ui/icon-button.js";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover.js";
import { Toggle } from "../ui/toggle.js";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip.js";
import { CustomBlockMenu, CustomBlockMenuItems, offeredBlocks } from "./custom-block-menu.js";
import { LinkForm, linkDraftFromSelection } from "./link-form.js";
import { ToolbarButton } from "./toolbar-button.js";
import { ToolbarDropdown } from "./toolbar-dropdown.js";
import { ToolbarMenuGroup, ToolbarMenuItem, ToolbarMenuSection } from "./toolbar-row.js";
import { ALIGN_TOOLS, BLOCK_STYLES, DIVIDER_TOOL, FOOTNOTE_TOOL, INLINE_PRIORITY, INSERT_TOOLS, inlineTools, LIST_STYLES, markToolKey, orderToolbar, PINNED_INLINE_MARKS, scriptTools, } from "./toolbar-tools.js";
export const buildToolbarEntries = ({ editor, site, t, tc, allowance, canEdit, markExtensions, blockStyle, activeList, activeAlign, linkDraft, setLinkDraft, openImageDialog, openFilePicker, }) => {
    const buttonSlot = (item, key, priority, fixed = false) => ({
        key,
        priority,
        fixed,
        render: () => _jsx(ToolbarButton, { editor: editor, item: item }),
        menu: () => _jsx(ToolbarMenuItem, { editor: editor, item: item }),
    });
    const dropdownSlot = (key, priority, label, items, icon, menuLabel = label) => ({
        key,
        priority,
        render: () => _jsx(ToolbarDropdown, { editor: editor, label: label, items: items, icon: icon, iconOnly: true }),
        menu: () => _jsx(ToolbarMenuGroup, { editor: editor, label: menuLabel, items: items }),
    });
    const UploadMenuItems = () => (_jsxs(_Fragment, { children: [allowance.allowsBlock("image") && (_jsxs(DropdownMenuItem, { disabled: !canEdit, onClick: () => openImageDialog(), children: [_jsx(ImageIcon, { "aria-hidden": true, className: "size-4" }), _jsx("span", { className: "flex-1", children: t("toolbar.image") })] })), allowance.allowsBlock("file") && (_jsxs(DropdownMenuItem, { disabled: !canEdit, onClick: () => openFilePicker(), children: [_jsx(Paperclip, { "aria-hidden": true, className: "size-4" }), _jsx("span", { className: "flex-1", children: t("toolbar.file") })] }))] }));
    // Order to hide when narrow: larger priority first. fixed is never hidden (popover tools lose their anchor inside the menu).
    // The placement order is decided by `TOOLBAR_ORDER(t)` below.
    const unordered = [
        {
            key: "block-style",
            priority: 0,
            fixed: true,
            render: () => _jsx(ToolbarDropdown, { editor: editor, label: blockStyle, items: BLOCK_STYLES(t, allowance) }),
        },
        ...(allowance.allowsBlock("text-align")
            ? [dropdownSlot("align", 9, t("toolbar.align"), ALIGN_TOOLS(t), activeAlign?.icon ?? AlignLeft)]
            : []),
        { key: "divider-block", divider: true },
        ...inlineTools(site, allowance).map((tool) => buttonSlot(tool, tool.mark, INLINE_PRIORITY[tool.mark] ?? 5, PINNED_INLINE_MARKS.includes(tool.mark))),
        // Formatting tools of text-style extensions (block extension text color, tooltip, etc.).
        ...markExtensions.flatMap(({ name, extension }) => {
            const tool = extension.toolbar;
            if (!tool)
                return [];
            const { Button, MenuItems } = tool;
            return [
                {
                    key: markToolKey(tool.group, name),
                    priority: tool.priority ?? 0,
                    fixed: tool.priority === undefined || !MenuItems,
                    render: () => _jsx(Button, { editor: editor }),
                    ...(MenuItems ? { menu: () => _jsx(MenuItems, { editor: editor }) } : {}),
                },
            ];
        }),
        ...(scriptTools(site, allowance).length > 0
            ? [dropdownSlot("script", 8, t("toolbar.script"), scriptTools(site, allowance), Superscript)]
            : []),
        { key: "divider-inline", divider: true },
        { key: "divider-list", divider: true },
        { key: "divider-insert", divider: true },
        dropdownSlot("list", 2, activeList?.title ?? t("toolbar.list"), LIST_STYLES(t, allowance), activeList?.icon ?? List, t("toolbar.list")),
        ...INSERT_TOOLS(t, allowance).map(({ tool, priority }) => buttonSlot(tool, tool.label, priority)),
        ...(offeredBlocks(site, editor).length > 0
            ? [
                {
                    key: "custom-block",
                    priority: 4,
                    render: () => _jsx(CustomBlockMenu, { editor: editor }),
                    menu: () => (_jsx(ToolbarMenuSection, { label: t("toolbar.components"), children: _jsx(CustomBlockMenuItems, { editor: editor }) })),
                },
            ]
            : []),
        ...(allowance.allowsBlock("image") || allowance.allowsBlock("file")
            ? [
                {
                    key: "upload",
                    // Hide later than underline (5). With the same priority, right-hand tools hide first.
                    priority: 4,
                    render: () => (_jsxs(DropdownMenu, { children: [_jsx(IconButton, { label: tc("upload"), side: "bottom", disabled: !canEdit, onMouseDown: (event) => event.preventDefault(), trigger: (button) => _jsx(DropdownMenuTrigger, { render: button }), children: _jsx(Upload, { className: "size-4", "aria-hidden": true }) }), _jsx(DropdownMenuContent, { align: "start", className: "min-w-40", children: _jsx(UploadMenuItems, {}) })] })),
                    menu: () => _jsx(UploadMenuItems, {}),
                },
            ]
            : []),
        ...(allowance.allowsMark("link")
            ? [
                {
                    key: "link",
                    priority: 0,
                    fixed: true,
                    render: () => (_jsxs(Popover, { open: linkDraft !== null, onOpenChange: (open) => setLinkDraft(open ? linkDraftFromSelection(editor) : null), children: [_jsxs(Tooltip, { children: [_jsx(TooltipTrigger, { render: _jsx(PopoverTrigger, { render: _jsx(Toggle, { size: "sm", pressed: editor.isActive("link"), disabled: !canEdit, "aria-label": t("toolbar.link"), onMouseDown: (event) => event.preventDefault(), className: "size-8 p-0" }), children: _jsx(Link2, { "aria-hidden": true, className: "size-4" }) }) }), _jsx(TooltipContent, { side: "bottom", children: t("toolbar.link") })] }), _jsx(PopoverContent, { align: "start", className: "w-80", children: linkDraft && _jsx(LinkForm, { editor: editor, draft: linkDraft, onDone: () => setLinkDraft(null) }) })] })),
                },
            ]
            : []),
        ...(allowance.allowsBlock("footnotes") ? [buttonSlot(FOOTNOTE_TOOL(t), FOOTNOTE_TOOL(t).label, 5)] : []),
        ...(allowance.allowsBlock("horizontalRule") ? [buttonSlot(DIVIDER_TOOL(t), "divider-tool", 8)] : []),
    ];
    return orderToolbar(t, unordered);
};
