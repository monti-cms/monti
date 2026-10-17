"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useSite, useTranslator } from "@monti-cms/core/site";
import { MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { errorText } from "../../api/client.js";
import { createEntryTranslation } from "../../api/entries.js";
import { useCmsMutation } from "../../api/use-cms-mutation.js";
import { commonMessages } from "../../lib/common.messages.js";
import { cn } from "../../lib/utils/cn.js";
import { useAdminRouter } from "../../router/index.js";
import { Button } from "../../ui/button.js";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../../ui/dropdown-menu.js";
import { IconButton } from "../../ui/icon-button.js";
import { StatusIndicator } from "../../ui/status-indicator.js";
import { statusLabels } from "../shared/entry-status.js";
import { isTranslationEntry } from "./entry-form.js";
import { entriesMessages } from "./messages.js";
const STATUS_TONE = {
    published: "success",
    draft: "warning",
};
/**
 * Language tabs above the title. Switch between languages of the same translation group; for a missing language, create a translation.
 * A translation is a draft copied from the original's per-language values and body saved on the server.
 */
export function LanguageTabs({ entry, disabled, onBeforeCreate, onTrashTranslation, className, }) {
    const t = useTranslator(entriesMessages);
    const tc = useTranslator(commonMessages);
    const site = useSite();
    const router = useAdminRouter();
    const [creating, setCreating] = useState(null);
    const members = entry.translations ?? [];
    const isTranslation = isTranslationEntry(entry);
    const createDisabled = disabled || entry.status === "trashed" || creating !== null;
    const translate = useCmsMutation({
        fn: (target, { site }) => createEntryTranslation(site, entry.id, target, t("lang.createFailed")),
        success: (_created, target) => t("lang.created", { lang: site.localeLabel(target) }),
        failure: t("lang.createFailed"),
        onSuccess: (created) => {
            setCreating(null);
            router.navigate(site.adminEntryEditHref(created.entry.id));
        },
        onError: () => setCreating(null),
    });
    const create = async (target) => {
        if (creating)
            return;
        setCreating(target);
        try {
            if (!(await onBeforeCreate())) {
                toast.error(t("lang.saveFirst"));
                setCreating(null);
                return;
            }
        }
        catch (error) {
            toast.error(errorText(site, error, t("lang.createFailed")));
            setCreating(null);
            return;
        }
        translate.mutate(target);
    };
    return (_jsx("nav", { "aria-label": t("lang.nav"), className: cn("mb-3.5 flex flex-wrap items-center gap-1 px-4 pt-2", className), children: site.LOCALES.map((target) => {
            const member = members.find((item) => item.locale === target);
            if (!member) {
                return (_jsxs(Button, { type: "button", size: "sm", variant: "ghost", disabled: createDisabled, "aria-label": t("lang.add", { lang: site.localeLabel(target) }), className: "h-7 gap-1 border border-dashed px-2 text-monti-muted-foreground text-xs", onClick: () => void create(target), children: [_jsx(Plus, { "aria-hidden": true, className: "size-3" }), target.toUpperCase()] }, target));
            }
            const current = member.id === entry.id;
            return (_jsxs("div", { className: "flex items-center", children: [_jsxs(Button, { type: "button", size: "sm", variant: "ghost", "aria-current": current ? "page" : undefined, "aria-label": t(member.isSource ? "lang.currentSource" : "lang.current", {
                            lang: site.localeLabel(target),
                            status: statusLabels(site)[member.status],
                        }), className: cn("h-7 gap-1.5 px-2 text-xs", current ? "bg-monti-muted text-monti-foreground" : "text-monti-muted-foreground"), onClick: () => {
                            if (!current)
                                router.navigate(site.adminEntryEditHref(member.id));
                        }, children: [_jsx(StatusIndicator, { size: "xs", tone: STATUS_TONE[member.status] ?? "neutral" }), _jsx("span", { "aria-hidden": true, className: "font-medium", children: target.toUpperCase() }), member.isSource && (_jsx("span", { "aria-hidden": true, className: "font-normal text-monti-muted-foreground", children: t("source") }))] }), current && isTranslation && entry.status !== "trashed" && (_jsxs(DropdownMenu, { children: [_jsx(IconButton, { label: t("lang.menu"), className: "size-7 text-monti-muted-foreground", trigger: (button) => _jsx(DropdownMenuTrigger, { render: button }), children: _jsx(MoreHorizontal, { "aria-hidden": true, className: "size-3.5" }) }), _jsx(DropdownMenuContent, { align: "start", children: _jsxs(DropdownMenuItem, { variant: "destructive", onClick: onTrashTranslation, children: [_jsx(Trash2, { "aria-hidden": true }), tc("lifecycle.trash")] }) })] }))] }, target));
        }) }));
}
