"use client";
import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { regenerateBlockIds } from "@monti-cms/core/document";
import { useSite, useTranslator } from "@monti-cms/core/site";
import { useQuery } from "@tanstack/react-query";
import { FileText, LayoutTemplate, RefreshCw, Settings } from "lucide-react";
import { useState } from "react";
import { listTemplates, templatesKeys } from "../../api/templates.js";
import { commonMessages } from "../../lib/common.messages.js";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, } from "../../ui/dropdown-menu.js";
import { IconButton } from "../../ui/icon-button.js";
import { useConfirm } from "../shared/confirm-dialog.js";
import { entriesMessages } from "./messages.js";
/**
 * Template menu at the end of the editor toolbar. Fetches the list on first open.
 * If the body is empty, inserts the chosen template right away; if there is body text, asks first whether to replace it.
 * A template is a document; applying one hands the entry a copy of it with new block ids (ids are unique within a body, and the translation and
 * diff views pair blocks by them, so the template's own ids must not end up in many entries).
 */
export function TemplateMenu({ currentDoc, disabled, onApply, }) {
    const t = useTranslator(entriesMessages);
    const tc = useTranslator(commonMessages);
    const site = useSite();
    const [open, setOpen] = useState(false);
    const { confirm, dialog } = useConfirm();
    // Fetched on first open, then kept: the manager page shares the same cache.
    const templatesQuery = useQuery({
        queryKey: templatesKeys.list(),
        queryFn: ({ signal }) => listTemplates(site, signal),
        enabled: open,
    });
    const templates = templatesQuery.data ?? null;
    const loadFailed = templatesQuery.isError && templates === null;
    const openMenu = (next) => {
        setOpen(next);
        if (next && templatesQuery.isError)
            void templatesQuery.refetch();
    };
    const choose = async (template) => {
        setOpen(false);
        if (currentDoc.content.length > 0 &&
            !(await confirm({
                title: t("template.applyTitle"),
                description: t("template.applyAsk", { name: template.name }),
                confirmLabel: tc("apply"),
                destructive: true,
            }))) {
            return;
        }
        onApply({ ...template.doc, content: regenerateBlockIds(template.doc.content) });
    };
    return (_jsxs(_Fragment, { children: [_jsxs(DropdownMenu, { open: open, onOpenChange: openMenu, children: [_jsx(IconButton, { label: t("template.menu"), disabled: disabled, trigger: (button) => _jsx(DropdownMenuTrigger, { render: button }), children: _jsx(LayoutTemplate, { "aria-hidden": true, className: "size-4" }) }), _jsxs(DropdownMenuContent, { align: "end", className: "max-h-80 min-w-56 overflow-y-auto", children: [loadFailed ? (_jsxs(_Fragment, { children: [_jsx(DropdownMenuItem, { disabled: true, children: t("template.loadFailed") }), _jsxs(DropdownMenuItem, { closeOnClick: false, onClick: () => void templatesQuery.refetch(), children: [_jsx(RefreshCw, { "aria-hidden": true }), t("retry")] })] })) : templates === null ? (_jsx(DropdownMenuItem, { disabled: true, children: tc("loading") })) : templates.length === 0 ? (_jsx(DropdownMenuItem, { disabled: true, children: t("template.none") })) : (templates.map((template) => (_jsxs(DropdownMenuItem, { onClick: () => void choose(template), children: [_jsx(FileText, { "aria-hidden": true }), _jsx("span", { className: "truncate", children: template.name })] }, template.id)))), _jsx(DropdownMenuSeparator, {}), _jsxs(DropdownMenuItem, { onClick: () => window.open(site.adminUrl("/templates"), "_blank", "noopener"), children: [_jsx(Settings, { "aria-hidden": true }), t("template.manage")] })] })] }), dialog] }));
}
