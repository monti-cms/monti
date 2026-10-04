"use client";
import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { adminUrl, cmsApiUrl } from "@monti-cms/core/client";
import { FileText, LayoutTemplate, RefreshCw, Settings } from "lucide-react";
import { useState } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, } from "../../ui/dropdown-menu.js";
import { IconButton } from "../../ui/icon-button.js";
import { cmsFetch } from "../admin-api.js";
import { useConfirm } from "../shared/confirm-dialog.js";
import { t } from "./translate.js";
/**
 * Template menu at the end of the editor toolbar. Fetches the list on first open.
 * If the body is empty, inserts the chosen template right away; if there is body text, asks first whether to replace it.
 */
export function TemplateMenu({ currentMdx, disabled, onApply, }) {
    const [open, setOpen] = useState(false);
    const [templates, setTemplates] = useState(null);
    const [loadFailed, setLoadFailed] = useState(false);
    const { confirm, dialog } = useConfirm();
    const load = async () => {
        setLoadFailed(false);
        try {
            const data = await cmsFetch(cmsApiUrl("/v1/templates"));
            setTemplates(data.items);
        }
        catch {
            setLoadFailed(true);
        }
    };
    const openMenu = (next) => {
        setOpen(next);
        if (next && !templates)
            void load();
    };
    const choose = async (template) => {
        setOpen(false);
        if (currentMdx.trim() &&
            !(await confirm({
                title: t("template.applyTitle"),
                description: t("template.applyAsk", { name: template.name }),
                confirmLabel: t("template.apply"),
                destructive: true,
            }))) {
            return;
        }
        onApply(template.mdx);
    };
    return (_jsxs(_Fragment, { children: [_jsxs(DropdownMenu, { open: open, onOpenChange: openMenu, children: [_jsx(IconButton, { label: t("template.menu"), disabled: disabled, trigger: (button) => _jsx(DropdownMenuTrigger, { render: button }), children: _jsx(LayoutTemplate, { "aria-hidden": true, className: "size-4" }) }), _jsxs(DropdownMenuContent, { align: "end", className: "max-h-80 w-56 overflow-y-auto", children: [loadFailed ? (_jsxs(_Fragment, { children: [_jsx(DropdownMenuItem, { disabled: true, children: t("template.loadFailed") }), _jsxs(DropdownMenuItem, { closeOnClick: false, onClick: () => void load(), children: [_jsx(RefreshCw, { "aria-hidden": true }), t("retry")] })] })) : templates === null ? (_jsx(DropdownMenuItem, { disabled: true, children: t("loading") })) : templates.length === 0 ? (_jsx(DropdownMenuItem, { disabled: true, children: t("template.none") })) : (templates.map((template) => (_jsxs(DropdownMenuItem, { onClick: () => void choose(template), children: [_jsx(FileText, { "aria-hidden": true }), _jsx("span", { className: "truncate", children: template.name })] }, template.id)))), _jsx(DropdownMenuSeparator, {}), _jsxs(DropdownMenuItem, { onClick: () => window.open(adminUrl("/templates"), "_blank", "noopener"), children: [_jsx(Settings, { "aria-hidden": true }), t("template.manage")] })] })] }), dialog] }));
}
