"use client";
import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useSite, useTranslator } from "@monti-cms/core/site";
import { SidebarTrigger } from "../../ui/sidebar.js";
import { ExportButton, ExportFields, ExportProgressLine } from "../export/export-fields.js";
import { exportMessages } from "../export/messages.js";
import { useExportForm } from "../export/use-export-form.js";
import { ImportEntriesFields } from "../import/import-entries-card.js";
import { importMessages } from "../import/messages.js";
import { restoreMessages } from "../restore/messages.js";
import { RestoreBackupFields } from "../restore/restore-card.js";
import { ShellPage } from "../shared/admin-shell.js";
import { sharedMessages } from "../shared/messages.js";
import { PageBody } from "../shared/page-body.js";
import { Section } from "../shared/section.js";
import { settingsMessages } from "./messages.js";
import { SettingsTabBar } from "./settings-tab-bar.js";
/**
 * The Data page of Settings (`<admin path>/settings/data`): what is kept in the site rather than in its schema file. It is a page of its own and shares nothing with the
 * schema tabs' draft, so it has no save bar. It holds the Site backup card, below it the Import entries card, and last the Restore backup card.
 */
export function DataScreen() {
    const t = useTranslator(settingsMessages);
    return (_jsx(ShellPage, { title: t("title"), nav: "settings", bare: true, children: _jsx(DataBody, {}) }));
}
function DataBody() {
    const t = useTranslator(settingsMessages);
    const te = useTranslator(exportMessages);
    const ti = useTranslator(importMessages);
    const tr = useTranslator(restoreMessages);
    const shared = useTranslator(sharedMessages);
    const site = useSite();
    const form = useExportForm();
    return (_jsxs(_Fragment, { children: [_jsxs("header", { className: "shrink-0 border-b bg-monti-background px-4 pt-5 lg:px-10 lg:pt-6", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2.5", children: [_jsx(SidebarTrigger, { "aria-label": shared("shell.openSidebar"), className: "-ml-1 text-monti-muted-foreground md:hidden" }), _jsx("h1", { className: "font-semibold text-[22px] leading-tight tracking-tight", children: t("title") })] }), _jsx("p", { className: "mt-1 text-monti-muted-foreground text-sm", children: t("data.description") }), _jsx(SettingsTabBar, { site: site, active: "data" })] }), _jsx("div", { className: "min-h-0 flex-1 overflow-y-auto bg-monti-muted/50", children: _jsxs(PageBody, { children: [_jsxs(Section, { wide: true, title: te("data.title"), description: te("data.description"), testId: "site-backup", children: [_jsx(ExportFields, { form: form }), _jsx(ExportProgressLine, { phase: form.phase }), _jsx("div", { children: _jsx(ExportButton, { form: form, label: te("action.all") }) })] }), _jsx(Section, { wide: true, title: ti("title"), description: ti("description"), testId: "import-entries", children: _jsx(ImportEntriesFields, {}) }), _jsx(Section, { wide: true, title: tr("title"), description: tr("description"), testId: "restore-backup", children: _jsx(RestoreBackupFields, {}) })] }) })] }));
}
